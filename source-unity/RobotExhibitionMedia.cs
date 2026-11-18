using System.IO;
using UnityEngine;

public sealed class RobotExhibitionMedia : ScriptableObject
{
    public string originalAssetPath = "10月23日.mov";
    public string decoderExecutable;
    [TextArea] public string introduction = "好的，接下来请跟随这段影像，一起了解未来设计实验室的空间与故事。";
    public string SourcePath { get { return Path.Combine(Application.dataPath, originalAssetPath); } }
    public bool Available { get { return File.Exists(SourcePath) && File.Exists(decoderExecutable); } }
    public static RobotExhibitionMedia Load() { return Resources.Load<RobotExhibitionMedia>("RobotExhibitionMedia"); }
}
