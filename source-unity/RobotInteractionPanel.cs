using UnityEngine;
using UnityEngine.UI;

// A real world-space sign attached to the robot, never to the visitor or screen.
public sealed class RobotInteractionPanel : MonoBehaviour
{
    private const float PanelScale = .0045f;
    private RobotSpatialGuide guide;
    private GameObject panel;
    private Font font;
    private CanvasGroup visibility;
    private void Awake() { guide = GetComponent<RobotSpatialGuide>(); }
    private RectTransform Rect(string name, Transform parent, float x, float y, float width, float height)
    {
        var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
        var rect = go.GetComponent<RectTransform>(); rect.anchorMin = rect.anchorMax = new Vector2(0, 1); rect.pivot = new Vector2(0, 1);
        rect.anchoredPosition = new Vector2(x, -y); rect.sizeDelta = new Vector2(width, height); return rect;
    }
    private void Box(string name, Transform parent, float x, float y, float w, float h, Color color)
    { var image = Rect(name, parent, x, y, w, h).gameObject.AddComponent<Image>(); image.color = color; image.raycastTarget = false; }
    private Text Label(string name, Transform parent, float x, float y, float w, float h, string text, int size, Color color, TextAnchor alignment = TextAnchor.MiddleLeft)
    {
        var label = Rect(name, parent, x, y, w, h).gameObject.AddComponent<Text>(); label.font = font; label.fontSize = size; label.text = text; label.color = color;
        label.alignment = alignment; label.raycastTarget = false; label.horizontalOverflow = HorizontalWrapMode.Wrap; label.verticalOverflow = VerticalWrapMode.Overflow; return label;
    }
    private void Build()
    {
        font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "Noto Sans CJK SC", "Arial" }, 32);
        panel = new GameObject("LittleD_WorldVoiceOptions", typeof(RectTransform), typeof(Canvas), typeof(CanvasGroup)); panel.transform.SetParent(transform, false);
        visibility = panel.GetComponent<CanvasGroup>(); visibility.alpha = 0; visibility.interactable = false; visibility.blocksRaycasts = false;
        var rect = panel.GetComponent<RectTransform>(); rect.sizeDelta = new Vector2(660, 285); rect.pivot = new Vector2(.5f, 0);
        rect.localPosition = new Vector3(0, 1.85f, 0); rect.localRotation = Quaternion.Euler(0, 180, 0); rect.localScale = Vector3.one * PanelScale;
        var canvas = panel.GetComponent<Canvas>(); canvas.renderMode = RenderMode.WorldSpace;
        // Ordinary depth testing: the sign leaves view with the robot and can be occluded by walls.
        var cyan = new Color(.2f, .92f, 1);
        Box("Dark glass", rect, 0, 0, 660, 285, new Color(.015f, .055f, .085f, .94f));
        Box("Top edge", rect, 0, 0, 660, 3, cyan); Box("Bottom edge", rect, 0, 282, 660, 3, cyan);
        Box("Left edge", rect, 0, 0, 3, 285, cyan); Box("Right edge", rect, 657, 0, 3, 285, cyan);
        Label("Brand", rect, 24, 14, 612, 25, "LITTLE D  /  FUTURE DESIGN LAB", 16, new Color(.55f, .82f, .9f));
        Label("Question", rect, 24, 43, 612, 48, "你想探索哪个部分？", 32, Color.white);
        for (int i = 0; i < 3; i++)
        {
            float x = 24 + i * 208;
            Box("Service card " + i, rect, x, 120, 196, 135, new Color(.035f, .18f, .24f, .96f));
            Label("Service " + i, rect, x + 6, 120, 184, 135, RobotVisitPoints.Services[i], 27, Color.white, TextAnchor.MiddleCenter);
        }
        panel.SetActive(false);
    }
    private void LateUpdate()
    {
        if (!guide) return;
        if (!panel) Build();
        panel.transform.localScale = Vector3.one * PanelScale;
        visibility.alpha = Mathf.MoveTowards(visibility.alpha, guide.ServicePanelVisible ? 1 : 0, Time.unscaledDeltaTime / .45f);
        panel.SetActive(guide.ServicePanelVisible || visibility.alpha > 0);
        if (!panel.activeSelf) return;
    }
    private void OnDestroy() { if (panel) Destroy(panel); if (font) Destroy(font); }
}
