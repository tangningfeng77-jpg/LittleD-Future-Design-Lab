using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;


// Full-screen presentation; visitors remain at reception, with no destination warp.
public sealed class RobotExhibitionVideo : MonoBehaviour
{
    private RobotOriginalFilmDecoder decoder;
    private AudioClip soundtrack;
    private float playedSeconds;
    public float PlayedSeconds { get { return playedSeconds; } }
    public string Diagnostics { get { return "running=" + running + "; seconds=" + playedSeconds + "; alpha=" + (opacity ? opacity.alpha.ToString() : "none") + "; " + (decoder != null ? decoder.Diagnostics : "no decoder"); } }
    public float Duration { get { return decoder != null ? decoder.Duration : 0; } }
    private AudioSource audioOutput;
    private Texture2D texture;
    private GameObject overlay;
    private CanvasGroup opacity;
    private RawImage picture;
    private bool running;
    private Action<bool> completion;
    private RobotRealtimeVoice voice;
    public bool IsPresenting { get { return running; } }
    public bool Ready { get { return decoder != null && decoder.Ready; } }
    public bool Available { get { var media = RobotExhibitionMedia.Load(); return media && media.Available; } }
    public void Warmup()
    {
        if (decoder != null) return;
        var media = RobotExhibitionMedia.Load(); if (!media || !media.Available) return;
        // Display sampling follows the viewport; the 8K source is never re-encoded.
        float scale = Mathf.Min(1, Mathf.Min(Screen.width / 7680f, Screen.height / 4320f));
        int width = Mathf.Max(2, Mathf.RoundToInt(7680 * scale / 2) * 2), height = Mathf.Max(2, Mathf.RoundToInt(4320 * scale / 2) * 2);
        if (texture) Destroy(texture);
        texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
        decoder = new RobotOriginalFilmDecoder(media.decoderExecutable, media.SourcePath, width, height);
        if (!audioOutput)
        {
            var sound = new GameObject("Original exhibition soundtrack"); sound.transform.SetParent(transform, false);
            audioOutput = sound.AddComponent<AudioSource>(); audioOutput.playOnAwake = false; audioOutput.spatialBlend = 0;
        }
    }
    private void UploadFrame() { decoder.Upload(bytes => { texture.LoadRawTextureData(bytes); texture.Apply(false, false); }); }
    public void Present(Action atBlack, Action<bool> finished)
    {
        if (running) return;
        running = true; completion = finished; StartCoroutine(Playback(atBlack));
    }
    private void BuildOverlay()
    {
        if (overlay) { picture.texture = texture; return; }
        overlay = new GameObject("LittleD_ExhibitionVideoOverlay", typeof(RectTransform), typeof(Canvas), typeof(CanvasGroup));
        // Overlay canvases stay at scene root; inheriting robot transforms can move them off-screen.
        var canvas = overlay.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 32000;
        opacity = overlay.GetComponent<CanvasGroup>(); opacity.alpha = 0; opacity.interactable = false; opacity.blocksRaycasts = false;
        var background = new GameObject("Cinema background", typeof(RectTransform), typeof(Image)); background.transform.SetParent(overlay.transform, false);
        var rect = background.GetComponent<RectTransform>(); rect.anchorMin = Vector2.zero; rect.anchorMax = Vector2.one; rect.offsetMin = rect.offsetMax = Vector2.zero;
        background.GetComponent<Image>().color = Color.black;
        var image = new GameObject("Exhibition film", typeof(RectTransform), typeof(RawImage), typeof(AspectRatioFitter)); image.transform.SetParent(overlay.transform, false);
        picture = image.GetComponent<RawImage>(); picture.texture = texture; picture.uvRect = new Rect(0, 1, 1, -1); picture.raycastTarget = false;
        var fitter = image.GetComponent<AspectRatioFitter>(); fitter.aspectMode = AspectRatioFitter.AspectMode.FitInParent; fitter.aspectRatio = (float)texture.width / texture.height;
        picture.enabled = false;
    }
    private IEnumerator Fade(float from, float to, float seconds)
    {
        for (float time = 0; time < seconds; time += Time.unscaledDeltaTime)
        {
            opacity.alpha = Mathf.SmoothStep(from, to, time / seconds);
            if (audioOutput) audioOutput.volume = picture.enabled ? opacity.alpha : 0;
            yield return null;
        }
        opacity.alpha = to; if (audioOutput) audioOutput.volume = picture.enabled ? to : 0;
    }
    private IEnumerator Playback(Action atBlack)
    {
        voice = GetComponent<RobotRealtimeVoice>(); if (voice) voice.SetPresentationAudio(true);
        bool success = false;
        try
        {
            Warmup();
            float until = Time.realtimeSinceStartup + 30;
            while (decoder != null && !decoder.Ready && string.IsNullOrEmpty(decoder.Error) && Time.realtimeSinceStartup < until) yield return null;
            if (decoder == null || !decoder.Ready || !string.IsNullOrEmpty(decoder.Error)) yield break;
            float[] sound = decoder.TakeSound(); soundtrack = AudioClip.Create("Original exhibition audio", sound.Length / 2, 2, 48000, false); soundtrack.SetData(sound, 0); audioOutput.clip = soundtrack;
            BuildOverlay(); overlay.SetActive(true); picture.enabled = false;
            yield return Fade(0, 1, .6f);
            atBlack?.Invoke(); UploadFrame();
            audioOutput.volume = 0; audioOutput.Play(); decoder.Play();
            float beganAt = Time.unscaledTime, bufferedSeconds = 0;
            picture.enabled = true;
            // Black to picture, then play with its original aspect ratio and soundtrack.
            picture.color = new Color(1, 1, 1, 0);
            for (float t = 0; t < .55f; t += Time.unscaledDeltaTime)
            { playedSeconds = Time.unscaledTime - beganAt; decoder.SetClock(playedSeconds); UploadFrame(); float a = Mathf.SmoothStep(0, 1, t / .55f); picture.color = new Color(1, 1, 1, a); audioOutput.volume = a; yield return null; }
            picture.color = Color.white; audioOutput.volume = 1;
            while (playedSeconds < decoder.Duration && string.IsNullOrEmpty(decoder.Error))
            {
                playedSeconds = Time.unscaledTime - beganAt - bufferedSeconds; decoder.SetClock(playedSeconds); UploadFrame();
                if (playedSeconds - decoder.LatestFrameSeconds > .35f)
                {
                    audioOutput.Pause(); float waitingAt = Time.unscaledTime;
                    while (playedSeconds - decoder.LatestFrameSeconds > .12f && string.IsNullOrEmpty(decoder.Error) && Time.unscaledTime - waitingAt < 15)
                    { UploadFrame(); yield return null; }
                    bufferedSeconds += Time.unscaledTime - waitingAt; audioOutput.UnPause();
                }
                yield return null;
            }
            success = string.IsNullOrEmpty(decoder.Error);
            yield return Fade(1, 0, .75f);
        }
        finally
        {
            if (decoder != null) { if (!success && !string.IsNullOrEmpty(decoder.Error)) Debug.LogWarning("Original film decode: " + decoder.Error); decoder.Dispose(); decoder = null; } if (audioOutput) audioOutput.Stop();
            if (soundtrack) { Destroy(soundtrack); soundtrack = null; }
            if (overlay) { opacity.alpha = 0; overlay.SetActive(false); }
            if (voice) voice.SetPresentationAudio(false);
            running = false; var done = completion; completion = null; done?.Invoke(success);
        }
    }
    private void OnDisable()
    {
        completion = null; StopAllCoroutines();
        if (decoder != null) { decoder.Dispose(); decoder = null; } if (audioOutput) audioOutput.Stop(); if (overlay) overlay.SetActive(false);
        if (voice) voice.SetPresentationAudio(false); running = false;
    }
    private void OnDestroy() { if (texture) Destroy(texture); if (overlay) Destroy(overlay); }
}
