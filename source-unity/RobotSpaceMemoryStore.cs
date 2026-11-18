using System;
using System.IO;
using UnityEngine;

// Draft authoring is project-local; the published snapshot is bundled with the game.
public static class RobotSpaceMemoryStore
{
    public static string SceneKey(string scene)
    {
        foreach (char c in Path.GetInvalidFileNameChars()) scene = scene.Replace(c, '_');
        return scene;
    }
    public static string DraftPath(string scene) { return Path.GetFullPath(Path.Combine(Application.dataPath, "../RobotKnowledge/" + SceneKey(scene) + "/draft.json")); }
    public static string PublishedPath(string scene) { return Path.Combine(Application.dataPath, "Resources/RobotKnowledge/" + SceneKey(scene) + ".json"); }
    public static RobotSpatialGuide.SpaceMemory Decode(string json, string scene)
    {
        var m = JsonUtility.FromJson<RobotSpatialGuide.SpaceMemory>(json);
        if (m == null || m.version != 1 || m.scene != scene || m.route == null || m.places == null || m.route.Count > 20000 || m.places.Count > 200) throw new InvalidDataException("Invalid space memory");
        if (m.route2 == null) m.route2 = new System.Collections.Generic.List<Vector3>();
        if (m.route3 == null) m.route3 = new System.Collections.Generic.List<Vector3>();
        for (int id = 0; id < 3; id++)
        {
            var route = RobotSpatialGuide.Route(m, id);
            if (route.Count > 20000) throw new InvalidDataException("Route too long");
            foreach (var p in route) if (!Finite(p)) throw new InvalidDataException("Invalid route coordinate");
        }
        foreach (var p in m.places) if (p == null || p.routeId < 0 || p.routeId > 2 || p.routeIndex < -1 || p.routeIndex >= RobotSpatialGuide.Route(m, p.routeId).Count || !Finite(p.position) || p.description == null || p.description.Length > 10000) throw new InvalidDataException("Invalid landmark");
        return m;
    }
    private static bool Finite(Vector3 p) { return !float.IsNaN(p.x) && !float.IsNaN(p.y) && !float.IsNaN(p.z) && !float.IsInfinity(p.x) && !float.IsInfinity(p.y) && !float.IsInfinity(p.z); }
    public static RobotSpatialGuide.SpaceMemory Copy(RobotSpatialGuide.SpaceMemory memory) { return Decode(JsonUtility.ToJson(memory), memory.scene); }
    public static void WriteAtomic(string path, RobotSpatialGuide.SpaceMemory memory)
    {
        Decode(JsonUtility.ToJson(memory), memory.scene);
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        string temp = path + ".tmp";
        File.WriteAllText(temp, JsonUtility.ToJson(memory, true));
        if (File.Exists(path)) File.Replace(temp, path, path + ".bak"); else File.Move(temp, path);
    }
    public static RobotSpatialGuide.SpaceMemory ReadPublished(string scene)
    {
#if UNITY_EDITOR
        string path = PublishedPath(scene);
        if (File.Exists(path)) return Decode(File.ReadAllText(path), scene);
#endif
        var resource = Resources.Load<TextAsset>("RobotKnowledge/" + SceneKey(scene));
        return resource ? Decode(resource.text, scene) : new RobotSpatialGuide.SpaceMemory { scene = scene };
    }
    public static RobotSpatialGuide.SpaceMemory ReadDraft(string scene)
    {
#if UNITY_EDITOR
        string path = DraftPath(scene);
        if (File.Exists(path)) return Decode(File.ReadAllText(path), scene);
#endif
        return Copy(ReadPublished(scene));
    }
    public static void MigrateLegacy(string scene)
    {
#if UNITY_EDITOR
        if (File.Exists(DraftPath(scene))) return;
        string legacy = Path.Combine(Application.persistentDataPath, "RobotSpace", "space-" + scene + ".json");
        if (!File.Exists(legacy)) return;
        var imported = Decode(File.ReadAllText(legacy), scene);
        if (imported.route.Count == 0 && imported.places.Count == 0 && File.Exists(legacy + ".previous"))
            imported = Decode(File.ReadAllText(legacy + ".previous"), scene);
        WriteAtomic(DraftPath(scene), imported);
        // Preserve the already taught content as the first player release, without overwriting an existing release.
        if (!File.Exists(PublishedPath(scene))) WriteAtomic(PublishedPath(scene), imported);
#endif
    }
}
