using System;
using UnityEngine;

// Two game cameras, never the desktop or editor UI. Captured only during a connected session.
public sealed class RobotRealtimeVision : MonoBehaviour
{
    public bool shareVision = true;
    public int SentFrames { get; private set; }
    public string Status { get; private set; } = "连接语音后上传双视角（左：玩家，右：小D），每秒最多一张";
    private Camera eyes;
    private RenderTexture frame;
    private Texture2D pair;
    private float nextFrame;
    private bool inFlight;
    private RobotRealtimeVoice voice;
    private void Awake()
    {
        voice = GetComponent<RobotRealtimeVoice>();
        var go = new GameObject("LittleD_EyeCamera");
        go.transform.SetParent(transform, false);
        go.transform.localPosition = new Vector3(0, 1.1f, .38f);
        eyes = go.AddComponent<Camera>(); eyes.enabled = false;
        eyes.nearClipPlane = .08f; eyes.farClipPlane = 100f; eyes.fieldOfView = 65f;
        eyes.cullingMask = ~(1 << 30); // The white shell must not obscure the eye view.
        frame = new RenderTexture(480, 270, 24);
        pair = new Texture2D(960, 270, TextureFormat.RGB24, false);
    }
    public string Context
    {
        get { return shareVision ? "\n视觉输入是游戏双视角拼图：左半是玩家摄像机，右半是小D眼睛摄像机。不是全知地图；只有本轮确实收到图像时才能描述看见的证据，按左右来源区分观察，不推测遮挡后空间。画面约每秒更新，不能将过去画面说成此刻画面。" : "\n当前已关闭视觉画面，不要声称亲眼看见。"; }
    }
    public void ResetSession() { SentFrames = 0; nextFrame = 0; }
    // Called AFTER an audio append, as required by the provider protocol.
    public async System.Threading.Tasks.Task UploadIfDue()
    {
        if (!shareVision || !voice || !voice.IsConnected || inFlight || Time.unscaledTime < nextFrame) return;
        var visitor = FindObjectOfType<ExhibitionFirstPerson>();
        Camera playerCamera = visitor ? visitor.GetComponentInChildren<Camera>() : Camera.main;
        if (!playerCamera || !playerCamera.enabled) { Status = "未找到启用的玩家摄像机，未上传画面"; return; }
        inFlight = true; nextFrame = Time.unscaledTime + 1f;
        try
        {
            Capture(playerCamera, 0); Capture(eyes, 480); pair.Apply(false);
            byte[] jpg = pair.EncodeToJPG(55);
            if (jpg.Length > 190000) jpg = pair.EncodeToJPG(25);
            if (jpg.Length > 190000) { Status = "画面超过大小限制，已跳过"; return; }
            if (await voice.SendVisionFrame(jpg))
            { SentFrames++; if (SentFrames == 1) voice.RefreshSpatialContext(); Status = "双视角已上传 " + SentFrames + " 帧 · 左玩家 / 右小D · 1帧/秒"; }
        }
        catch (Exception ex) { Status = "视觉上传失败：" + ex.GetType().Name; }
        finally { inFlight = false; }
    }
    private void Capture(Camera camera, int x)
    {
        var previous = RenderTexture.active; var target = camera.targetTexture;
        float aspect = camera.aspect;
        try
        {
            camera.targetTexture = frame; camera.aspect = 16f / 9f; camera.Render();
            RenderTexture.active = frame;
            pair.ReadPixels(new Rect(0, 0, 480, 270), x, 0, false);
        }
        finally { camera.targetTexture = target; camera.aspect = aspect; RenderTexture.active = previous; }
    }
    private void OnDestroy()
    {
        if (eyes) Destroy(eyes.gameObject);
        if (frame) { frame.Release(); Destroy(frame); }
        if (pair) Destroy(pair);
    }
}
