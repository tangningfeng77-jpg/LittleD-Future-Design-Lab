using System;

// Playback-reference echo suppression for the existing WebSocket preview.
// Delay search covers remote audio forwarding (up to 1 second). This is not
// a replacement for a device/RTC acoustic echo canceller in a reverberant room.
public sealed class RobotEchoFilter
{
    private readonly object sync = new object();
    private readonly float[] history = new float[32768];
    private readonly float[] snapshot = new float[17600];
    private long written;
    private double renderPosition;
    private long renderFrames;
    public float Correlation { get; private set; }
    public void Reset()
    {
        lock (sync) { Array.Clear(history, 0, history.Length); written = renderFrames = 0; renderPosition = 0; }
    }
    // Called on the audio thread with the samples actually pulled for playback,
    // including silence, never with generated-but-not-played network audio.
    public void Render24(float[] data, float volume)
    {
        lock (sync)
        {
            while (renderPosition < renderFrames + data.Length)
            {
                int i = (int)(renderPosition - renderFrames);
                if (i >= 0) history[(int)(written++ % history.Length)] = data[Math.Min(i, data.Length - 1)] * volume;
                renderPosition += 1.5;
            }
            renderFrames += data.Length;
        }
    }
    // Input is one 100 ms mono 16 kHz block. Subtract only a positively identified
    // delayed copy. Uncorrelated near-end speech is preserved during double-talk.
    public void Process(float[] microphone)
    {
        int count = microphone.Length;
        if (count != 1600) throw new ArgumentException("Expected 100 ms at 16 kHz");
        lock (sync)
        {
            long start = written - snapshot.Length;
            for (int i = 0; i < snapshot.Length; i++)
                snapshot[i] = start + i < 0 ? 0 : history[(int)((start + i) % history.Length)];
        }
        double inputEnergy = 0; for (int i = 0; i < count; i++) inputEnergy += microphone[i] * microphone[i];
        if (inputEnergy < count * .00000025) { Array.Clear(microphone, 0, count); return; }
        double bestScore = 0; int best = -1;
        // Sparse correlation for every possible delay, then full-block validation.
        for (int start = 0; start <= snapshot.Length - count; start++)
        {
            double dot = 0, energy = 0, input = 0;
            for (int i = 0; i < count; i += 16)
            {
                float x = snapshot[start + i], y = microphone[i];
                dot += x * y; energy += x * x; input += y * y;
            }
            double score = dot * dot / (energy * input + 1e-20);
            if (energy > .00001 && score > bestScore) { bestScore = score; best = start; }
        }
        Correlation = 0;
        if (best < 0 || bestScore < .16) return;
        double sum = 0, referenceEnergy = 0;
        for (int i = 0; i < count; i++) { float x = snapshot[best + i]; sum += microphone[i] * x; referenceEnergy += x * x; }
        double coherence = sum * sum / (referenceEnergy * inputEnergy + 1e-20);
        Correlation = (float)Math.Sqrt(coherence);
        if (coherence < .16 || referenceEnergy < .00001) return;
        float gain = (float)Math.Max(-4, Math.Min(4, sum / referenceEnergy));
        double residual = 0;
        for (int i = 0; i < count; i++) { microphone[i] -= gain * snapshot[best + i]; residual += microphone[i] * microphone[i]; }
        // Strong echo-only matches are muted; a second independent voice is kept.
        if (residual < inputEnergy * .08 || residual < count * .000001)
            Array.Clear(microphone, 0, count);
    }
}
