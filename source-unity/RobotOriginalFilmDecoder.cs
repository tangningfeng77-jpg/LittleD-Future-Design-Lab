using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

// Decode the original HEVC file without producing a recompressed video.
// Raw frames are sized to the current display viewport, like a normal player.
internal sealed class RobotOriginalFilmDecoder : IDisposable
{
    private readonly object frameLock = new object();
    private readonly string source, executable;
    private readonly int width, height;
    private Process pictureProcess, audioProcess;
    private byte[] published;
    private volatile int publishedIndex = -1;
    private int consumedIndex = -1;
    private volatile bool disposed, playing, audioReady, decodedEnd;
    private volatile float playbackSeconds;
    private volatile string error;
    private float[] audio;
    private int decodedFrames;
    public bool Ready { get { return publishedIndex >= 0 && audioReady; } }
    public string Diagnostics { get { return "frame=" + publishedIndex + "; audioReady=" + audioReady + "; playing=" + playing + "; error=" + error; } }
    public string Error { get { return error; } }
    public float Duration { get { return audioReady ? audio.Length / 96000f : 0; } }
    public float LatestFrameSeconds { get { return publishedIndex / 30f; } }
    public bool Finished { get { return decodedEnd && playbackSeconds >= decodedFrames / 30f; } }
    public RobotOriginalFilmDecoder(string binary, string file, int displayWidth, int displayHeight)
    {
        executable = binary; source = file; width = displayWidth; height = displayHeight;
        // Start the two decoders sequentially: overlapping Windows child-pipe creation
        // in Unity Mono can keep the audio pipe open and prevent EOF forever.
        Task.Run(() => { ReadSound(); if (audioReady && !disposed) ReadPictures(); });
    }
    private Process Start(string options)
    {
        var process = new Process { StartInfo = new ProcessStartInfo {
            FileName = executable, Arguments = "-hide_banner -loglevel error -nostdin -threads 16 -i \"" + source + "\" " + options,
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true
        } };
        if (disposed) throw new OperationCanceledException();
        process.Start();
        if (disposed) { process.Kill(); throw new OperationCanceledException(); }
        // Drain stderr independently so a decoder error cannot block stdout.
        process.ErrorDataReceived += (s, e) => { if (!disposed && !string.IsNullOrWhiteSpace(e.Data)) error = e.Data; };
        process.BeginErrorReadLine(); return process;
    }
    private void ReadSound()
    {
        try
        {
            audioProcess = Start("-map 0:a:0 -vn -ac 2 -ar 48000 -c:a pcm_f32le -f f32le pipe:1");
            if (disposed) { audioProcess.Kill(); return; }
            using (var memory = new MemoryStream())
            {
                byte[] chunk = new byte[65536]; int count;
                while (!disposed && (count = audioProcess.StandardOutput.BaseStream.Read(chunk, 0, chunk.Length)) > 0)
                {
                    memory.Write(chunk, 0, count);
                    if (memory.Length > 100 * 1024 * 1024) throw new IOException("Film soundtrack exceeds preview buffer limit");
                }
                if (!audioProcess.WaitForExit(5000)) throw new IOException("Audio decoder did not exit"); if (disposed) return;
                if (audioProcess.ExitCode != 0 || memory.Length < 8) throw new IOException("Original film audio decode failed");
                var bytes = memory.ToArray(); audio = new float[bytes.Length / 4]; Buffer.BlockCopy(bytes, 0, audio, 0, audio.Length * 4); audioReady = true;
            }
        }
        catch (Exception ex) { if (!disposed) error = ex.Message; }
    }
    private void ReadPictures()
    {
        try
        {
            pictureProcess = Start("-map 0:v:0 -an -vf scale=" + width + ":" + height + ":flags=lanczos -vsync 0 -pix_fmt rgba -f rawvideo pipe:1");
            if (disposed) { pictureProcess.Kill(); return; }
            byte[] work = new byte[width * height * 4]; int index = 0;
            while (!disposed)
            {
                while (!disposed && index > 0 && (!playing || index > playbackSeconds * 30 + 2)) Thread.Sleep(5);
                if (disposed) return;
                int read = 0;
                while (read < work.Length)
                {
                    int size = pictureProcess.StandardOutput.BaseStream.Read(work, read, work.Length - read);
                    if (size == 0) break; read += size;
                }
                if (read == 0) break;
                if (read != work.Length) throw new IOException("Incomplete original film frame");
                lock (frameLock)
                {
                    byte[] previous = published; published = work; publishedIndex = index++;
                    work = previous ?? new byte[width * height * 4]; decodedFrames = index;
                }
            }
            if (!pictureProcess.WaitForExit(5000)) throw new IOException("Picture decoder did not exit"); if (!disposed && pictureProcess.ExitCode != 0) throw new IOException("Original film picture decode failed");
            decodedEnd = true;
        }
        catch (Exception ex) { if (!disposed) error = ex.Message; }
    }
    public float[] TakeSound() { return audio; }
    public void Play() { playbackSeconds = 0; playing = true; }
    public void SetClock(float seconds) { playbackSeconds = seconds; }
    public bool Upload(Action<byte[]> consumer)
    {
        lock (frameLock)
        {
            if (published == null || consumedIndex == publishedIndex) return false;
            consumer(published); consumedIndex = publishedIndex; return true;
        }
    }
    public void Dispose()
    {
        disposed = true;
        foreach (var process in new[] { pictureProcess, audioProcess })
            try { if (process != null && !process.HasExited) process.Kill(); } catch (Exception) { }
    }
}
