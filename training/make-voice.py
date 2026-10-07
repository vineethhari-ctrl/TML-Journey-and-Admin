"""
Voice-over for the training video (offline text-to-speech; no AI service, nothing leaves the machine).

  python3 training/make-voice.py speak   # read training/output/chapters.json, make the voice clips, write durations.json
  python3 training/make-voice.py mix     # put each clip at its caption time and write TML-Admin-Portal-Training-Voice.mp4

Order: FAST=1 npm run training-video (dry run, writes chapters.json)  ->  speak  ->  npm run training-video (real
recording; every screen now waits for its voice line)  ->  mix.
Needs: pip install sherpa-onnx soundfile imageio-ffmpeg, and the voice model folder given in VOICE_DIR
(vits-piper-en_US-lessac-high from github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models).
"""
import json
import os
import re
import subprocess
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
VOICE_DIR = os.environ.get('VOICE_DIR', '/tmp/voice2/vits-piper-en_US-lessac-high/')
CLIPS = os.path.join(OUT, 'voice')


def spoken(text):
    t = re.sub(r'^\[[^\]]*\]\s*', '', text)
    for a, b in [('Ctrl +', 'control'), ('Ctrl', 'control'), ('·', '.'), ('…', '.'), ('LOV', 'L O V'), ('PPL', 'P P L'), ('BU', 'B U'), ('BA ', 'B A '), ('UoM', 'U o M'), ('+ Add Row', 'Add Row'), ('->', 'to')]:
        t = t.replace(a, b)
    return t


def speak():
    import sherpa_onnx as s
    import soundfile as sf
    cfg = s.OfflineTtsConfig(model=s.OfflineTtsModelConfig(vits=s.OfflineTtsVitsModelConfig(
        model=VOICE_DIR + 'en_US-lessac-high.onnx', tokens=VOICE_DIR + 'tokens.txt', data_dir=VOICE_DIR + 'espeak-ng-data'), num_threads=4))
    tts = s.OfflineTts(cfg)
    lines = json.load(open(os.path.join(OUT, 'chapters.json')))
    os.makedirs(CLIPS, exist_ok=True)
    durations = {}
    for i, x in enumerate(lines):
        a = tts.generate(spoken(x['text']), sid=0, speed=0.95)
        sf.write(os.path.join(CLIPS, f'{i}.wav'), a.samples, a.sample_rate)
        durations[x['text']] = len(a.samples) / a.sample_rate
    json.dump(durations, open(os.path.join(OUT, 'durations.json'), 'w'), indent=1)
    print(f'{len(lines)} clips, {sum(durations.values()) / 60:.1f} minutes of speech')


def mix():
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    lines = json.load(open(os.path.join(OUT, 'chapters.json')))
    video = os.path.join(OUT, 'TML-Admin-Portal-Training.webm')
    ins, fl = [], []
    for i, x in enumerate(lines):
        ins += ['-i', os.path.join(CLIPS, f'{i}.wav')]
        ms = int(x['at'] * 1000)
        fl.append(f'[{i + 1}:a]adelay={ms}|{ms}[a{i}]')
    fl.append(''.join(f'[a{i}]' for i in range(len(lines))) + f'amix=inputs={len(lines)}:normalize=0[a]')
    script = os.path.join(OUT, 'mix-filter.txt')
    open(script, 'w').write(';\n'.join(fl))
    dst = os.path.join(OUT, 'TML-Admin-Portal-Training-Voice.mp4')
    r = subprocess.run([ff, '-y', '-i', video] + ins + ['-filter_complex_script', script, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', dst], capture_output=True, text=True)
    print(r.returncode, dst)
    if r.returncode:
        print(r.stderr[-800:])


if __name__ == '__main__':
    {'speak': speak, 'mix': mix}[sys.argv[1]]()
