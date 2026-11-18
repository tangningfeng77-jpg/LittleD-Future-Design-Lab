using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

// Destination data is separate from the teaching knowledge. No route is generated.
public static class RobotVisitPoints
{
    public static readonly string[] Services = { "展厅介绍", "设计咨询", "创意工坊" };
    [Serializable] public sealed class Point
    {
        public string service;
        public bool robotSet, playerSet;
        public Vector3 robotGround, playerGround;
        public float robotYaw = 180, playerYaw;
        public bool Ready { get { return robotSet && playerSet; } }
    }
    [Serializable] public sealed class Data
    {
        public int version = 1;
        public string scene;
        public List<Point> points = new List<Point>();
        public bool entryStartSet, entryStopSet;
        public Vector3 entryStartGround, entryStopGround;
        public float arrivalSpeed = 2.8f;
        public string introduction = "你好，我是小D，欢迎来到未来设计实验室。实验室融合创新设计、人工智能与产业应用，聚焦数据智能与产品创新、绿色设计与智能装备、数字文旅创新技术三大方向。我会陪你了解这里的空间，也可以一起聊聊设计需求、探索创意。";
        public string choiceQuestion = "你想探索哪个部分？展厅介绍、设计咨询，还是创意工坊？直接告诉我就好。";
        public bool EntryReady { get { return entryStartSet && entryStopSet; } }
    }
    public static Data Empty(string scene)
    {
        var data = new Data { scene = scene };
        foreach (string service in Services) data.points.Add(new Point { service = service });
        return data;
    }
    public static string PathFor(string scene) { return Path.Combine(Application.dataPath, "Resources/RobotVisitPoints/" + RobotSpaceMemoryStore.SceneKey(scene) + ".json"); }
    public static Data Decode(string json, string scene)
    {
        var data = JsonUtility.FromJson<Data>(json);
        if (data == null || data.version != 1 || data.scene != scene || data.points == null || data.points.Count != 3) throw new InvalidDataException("Invalid visit points");
        // Version 1 destination files predate the automatic opening fields.
        var defaults = new Data();
        if (!json.Contains("\"arrivalSpeed\"")) data.arrivalSpeed = defaults.arrivalSpeed;
        if (!json.Contains("\"introduction\"")) data.introduction = defaults.introduction;
        if (!json.Contains("\"choiceQuestion\"")) data.choiceQuestion = defaults.choiceQuestion;
        if (!Finite(data.entryStartGround) || !Finite(data.entryStopGround) || float.IsNaN(data.arrivalSpeed) || float.IsInfinity(data.arrivalSpeed) || data.arrivalSpeed < .3f || data.arrivalSpeed > 3f) throw new InvalidDataException("Invalid arrival flow");
        if (data.introduction == null || data.choiceQuestion == null || data.introduction.Length > 3000 || data.choiceQuestion.Length > 1000) throw new InvalidDataException("Invalid arrival speech");
        for (int i = 0; i < 3; i++)
        {
            var point = data.points[i];
            if (point == null || point.service != Services[i] || !Finite(point.robotGround) || !Finite(point.playerGround) || float.IsNaN(point.robotYaw) || float.IsInfinity(point.robotYaw) || float.IsNaN(point.playerYaw) || float.IsInfinity(point.playerYaw)) throw new InvalidDataException("Invalid visit point");
        }
        return data;
    }
    private static bool Finite(Vector3 p) { return !float.IsNaN(p.x) && !float.IsInfinity(p.x) && !float.IsNaN(p.y) && !float.IsInfinity(p.y) && !float.IsNaN(p.z) && !float.IsInfinity(p.z); }
    public static Data Load(string scene)
    {
#if UNITY_EDITOR
        string path = PathFor(scene);
        if (File.Exists(path)) return Decode(File.ReadAllText(path), scene);
#endif
        var text = Resources.Load<TextAsset>("RobotVisitPoints/" + RobotSpaceMemoryStore.SceneKey(scene));
        return text ? Decode(text.text, scene) : Empty(scene);
    }
#if UNITY_EDITOR
    public static void Save(Data data)
    {
        Decode(JsonUtility.ToJson(data), data.scene);
        string path = PathFor(data.scene); Directory.CreateDirectory(Path.GetDirectoryName(path));
        string temp = path + ".tmp"; File.WriteAllText(temp, JsonUtility.ToJson(data, true));
        if (File.Exists(path)) File.Replace(temp, path, path + ".bak"); else File.Move(temp, path);
    }
#endif
}
