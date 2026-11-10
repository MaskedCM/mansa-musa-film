import json
import math
import os
import struct
import subprocess
import wave

BASE_DIR = r"c:\Users\mania\.antigravity-ide\mansa-musa-film"
AUDIO_DIR = os.path.join(BASE_DIR, "audio_parts")
SFX_DIR = os.path.join(BASE_DIR, "assets", "sfx")
TIMINGS_PATH = os.path.join(BASE_DIR, "timings.json")


def load_sfx_pcm(filename, gain=1.0, max_dur_s=None):
    """Decodes a studio SFX mp3 from assets/sfx into 44.1kHz mono 16-bit PCM samples."""
    src_path = os.path.join(SFX_DIR, filename)
    if not os.path.exists(src_path):
        return []
    tmp_wav = os.path.join(AUDIO_DIR, f"_sfx_{filename}.wav")
    if not os.path.exists(tmp_wav):
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "44100", "-ac", "1", tmp_wav],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    with wave.open(tmp_wav, "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    samples = list(struct.unpack(f"<{len(raw)//2}h", raw))
    if max_dur_s is not None:
        max_n = int(max_dur_s * 44100)
        samples = samples[:max_n]
    return [int(s * gain) for s in samples]


def load_trimmed_beat_from_existing(beat_entry, sr=44100):
    bid = beat_entry["id"]
    wav_path = os.path.join(AUDIO_DIR, f"beat_{bid:02d}.wav")
    with wave.open(wav_path, "rb") as wf:
        raw = wf.readframes(wf.getnframes())

    target_samples = int(round(beat_entry["duration"] * sr))
    # Find onset in raw wav where voice starts, matching our 45ms pre-word lead
    total_raw_samples = len(raw) // 2
    samples = list(struct.unpack(f"<{total_raw_samples}h", raw))
    onset_idx = 0
    for idx, val in enumerate(samples):
        if abs(val) > 350:
            onset_idx = max(0, idx - int(0.045 * sr))
            break
    end_idx = min(total_raw_samples, onset_idx + target_samples)
    trimmed = bytearray(raw[onset_idx * 2 : end_idx * 2])
    if len(trimmed) < target_samples * 2:
        trimmed.extend(b"\x00\x00" * (target_samples - len(trimmed) // 2))
    elif len(trimmed) > target_samples * 2:
        trimmed = trimmed[: target_samples * 2]

    fade_samples = min(int(0.07 * sr), len(trimmed) // 2)
    for i in range(fade_samples):
        idx = (len(trimmed) // 2 - fade_samples + i) * 2
        val = struct.unpack_from("<h", trimmed, idx)[0]
        gain = 0.5 * (1.0 + math.cos(math.pi * i / fade_samples))
        struct.pack_into("<h", trimmed, idx, int(val * gain))
    return bytes(trimmed)


def mix_hyperframes_sound(voice_bytes, sr, final_duration):
    """
    Follows HyperFrames sound.md contract:
    - Real studio SFX files from skills/media-use/audio/assets/sfx/ (no synthesised chimes or dings)
    - Rotate between takes (whoosh-cinematic, whoosh-short, whoosh / impact-bass-1, impact-bass-2)
    - Place each hit so its peak lands 1 frame (+0.033s) after the picture hit
    - Subtle studio BGM bed ducked at ~0.11 under the narrator voice, with 0.4s fade-in and 1.5s fade-out
    """
    n_samples = len(voice_bytes) // 2
    mix_arr = list(struct.unpack(f"<{n_samples}h", voice_bytes))

    whoosh_takes = [
        load_sfx_pcm("whoosh-short.mp3", gain=0.22),
        load_sfx_pcm("whoosh.mp3", gain=0.20),
        load_sfx_pcm("whoosh-cinematic.mp3", gain=0.24),
    ]
    impact_takes = [
        load_sfx_pcm("impact-bass-1.mp3", gain=0.32),
        load_sfx_pcm("impact-bass-2.mp3", gain=0.32),
    ]
    pop_sfx = load_sfx_pcm("pop.mp3", gain=0.25)
    typing_sfx = load_sfx_pcm("typing.mp3", gain=0.18, max_dur_s=0.65)
    click_soft = load_sfx_pcm("click-soft.mp3", gain=0.22)
    riser_sfx = load_sfx_pcm("riser.mp3", gain=0.22, max_dur_s=2.4)
    bgm_loop = load_sfx_pcm("bgm.mp3", gain=1.0)

    def overlay_pcm(samples, start_s):
        i0 = max(0, int(round(start_s * sr)))
        for k, s in enumerate(samples):
            idx = i0 + k
            if idx >= n_samples:
                break
            mix_arr[idx] += s

    one_frame = 1.0 / 30.0
    whoosh_idx = 0
    impact_idx = 0

    for t_whoosh in [0.05, 12.95, 23.95, 28.95, 34.18, 55.55, 60.35, 65.75]:
        overlay_pcm(whoosh_takes[whoosh_idx % len(whoosh_takes)], t_whoosh + one_frame)
        whoosh_idx += 1

    for t_type in [6.53, 9.56, 37.02, 72.55]:
        overlay_pcm(typing_sfx, t_type + one_frame)

    for t_imp in [18.80, 47.52, 51.72, 61.66]:
        overlay_pcm(impact_takes[impact_idx % len(impact_takes)], t_imp + one_frame)
        impact_idx += 1

    overlay_pcm(pop_sfx, 24.00 + one_frame)
    for c_i in range(5):
        overlay_pcm(click_soft if c_i % 2 == 0 else pop_sfx, 38.95 + c_i * 0.16 + one_frame)

    overlay_pcm(riser_sfx, 70.20)

    if bgm_loop:
        env = 0.0
        bgm_len = len(bgm_loop)
        for i in range(n_samples):
            t = i / sr
            v_abs = abs(mix_arr[i]) / 32768.0
            env = 0.9993 * env + 0.0007 * v_abs
            fade_in = min(1.0, t / 0.4)
            fade_out = min(1.0, max(0.0, (final_duration - t) / 1.5))
            duck_gain = 0.13 - min(0.06, env * 0.45)
            bgm_val = int(bgm_loop[i % bgm_len] * duck_gain * fade_in * fade_out)
            val = mix_arr[i] + bgm_val
            if val > 32600:
                val = 32600
            elif val < -32600:
                val = -32600
            mix_arr[i] = val

    return struct.pack(f"<{n_samples}h", *mix_arr)


def main():
    with open(TIMINGS_PATH, "r", encoding="utf-8") as f:
        timings = json.load(f)

    sr = 44100
    final_duration = timings["total_duration"]
    total_samples = int(round(final_duration * sr))
    master_samples = bytearray(b"\x00\x00" * total_samples)

    for beat_entry in timings["beats"]:
        pcm_bytes = load_trimmed_beat_from_existing(beat_entry, sr)
        start_idx = int(round(beat_entry["start"] * sr)) * 2
        end_idx = min(len(master_samples), start_idx + len(pcm_bytes))
        master_samples[start_idx:end_idx] = pcm_bytes[: end_idx - start_idx]

    mixed_pcm = mix_hyperframes_sound(bytes(master_samples), sr, final_duration)

    raw_wav = os.path.join(AUDIO_DIR, "master_raw.wav")
    master_wav = os.path.join(BASE_DIR, "voiceover.wav")
    assets_wav = os.path.join(BASE_DIR, "assets", "voiceover.wav")
    master_mp3 = os.path.join(BASE_DIR, "voiceover.mp3")

    with wave.open(raw_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(mixed_pcm)

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", raw_wav,
            "-af", "loudnorm=I=-15:TP=-1.5:LRA=11",
            "-ar", "44100", "-ac", "1", master_wav,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    subprocess.run(
        ["ffmpeg", "-y", "-i", master_wav, "-c:a", "copy", assets_wav],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    subprocess.run(
        ["ffmpeg", "-y", "-i", master_wav, "-codec:a", "libmp3lame", "-b:a", "192k", master_mp3],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Mixed real HyperFrames studio SFX & normalized voiceover.wav ({final_duration}s)")


if __name__ == "__main__":
    main()
