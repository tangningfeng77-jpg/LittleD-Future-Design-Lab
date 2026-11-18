using UnityEngine;

// Standard capsule locomotion for the scripted visitor: step offset, slopes and gravity.
[RequireComponent(typeof(CapsuleCollider))]
public sealed class RobotAutomaticWalker : MonoBehaviour
{
    private CapsuleCollider original;
    private CharacterController motor;
    private bool originalEnabled, active;
    private float verticalSpeed, blockedTime;
    public float RootFeetOffset { get { return transform.position.y - Feet.y; } }
    private Vector3 Feet { get { return transform.TransformPoint(motor.center) - Vector3.up * motor.height * Mathf.Abs(transform.lossyScale.y) * .5f; } }
    private void Awake()
    {
        original = GetComponent<CapsuleCollider>(); originalEnabled = original.enabled;
        motor = GetComponent<CharacterController>();
        if (!motor) motor = gameObject.AddComponent<CharacterController>();
        motor.enabled = false; motor.center = original.center; motor.height = original.height; motor.radius = original.radius;
        motor.skinWidth = .025f; motor.minMoveDistance = 0; motor.slopeLimit = 50;
        motor.stepOffset = Mathf.Min(.45f, motor.height * .35f);
    }
    public void SetActive(bool enabled)
    {
        if (active == enabled) return;
        active = enabled; motor.enabled = false; original.enabled = enabled ? false : originalEnabled;
        motor.enabled = enabled; verticalSpeed = blockedTime = 0; Physics.SyncTransforms();
    }
    public void Warp(Vector3 position, Quaternion rotation)
    {
        bool enabled = motor.enabled; motor.enabled = false; transform.SetPositionAndRotation(position, rotation); motor.enabled = enabled;
        var body = GetComponent<Rigidbody>(); if (body) { body.position = position; body.rotation = rotation; }
        verticalSpeed = blockedTime = 0; Physics.SyncTransforms();
    }
    public bool Step(Vector3 target, float speed, float deltaTime, out string reason)
    {
        reason = ""; if (!active || deltaTime <= 0) return false;
        Vector3 flat = Vector3.ProjectOnPlane(target - transform.position, Vector3.up);
        Vector3 stride = Vector3.ClampMagnitude(flat, speed * Mathf.Min(deltaTime, .05f));
        // Detect a landing before stepping off an edge; stairs down are supported by gravity.
        if (stride.sqrMagnitude > .000001f && !Supported(Feet + stride, .65f))
        { reason = "前方没有可站立踏面，已暂停；不会跨越悬空缺口。"; return false; }
        Vector3 before = transform.position;
        verticalSpeed = motor.isGrounded ? -2 : Mathf.Max(verticalSpeed - 22 * deltaTime, -9);
        var flags = motor.Move(stride + Vector3.up * verticalSpeed * Mathf.Min(deltaTime, .05f));
        float moved = Vector3.ProjectOnPlane(transform.position - before, Vector3.up).magnitude;
        if (stride.magnitude > .0001f && moved < stride.magnitude * .3f && (flags & CollisionFlags.Sides) != 0 && Supported(Feet, .18f))
            TryStep(flat.normalized, Mathf.Min(flat.magnitude, .15f));
        moved = Vector3.ProjectOnPlane(transform.position - before, Vector3.up).magnitude;
        if (stride.magnitude > .001f && moved < stride.magnitude * .2f) blockedTime += deltaTime; else blockedTime = 0;
        if (blockedTime > .5f) reason = "前方障碍过高或身体净空不足，已暂停；请调整通行空间。";
        Physics.SyncTransforms(); return moved > .00001f;
    }
    private bool Supported(Vector3 feet, float drop)
    {
        // Mesh treads and floor modules can have a tiny seam under the capsule centre.
        // Test the supporting footprint, just as the capsule itself bridges that seam.
        float reach = motor.radius * Mathf.Max(Mathf.Abs(transform.lossyScale.x), Mathf.Abs(transform.lossyScale.z)) * .65f;
        foreach (var offset in new[] { Vector3.zero, Vector3.forward * reach, Vector3.back * reach, Vector3.right * reach, Vector3.left * reach })
            foreach (var hit in Physics.RaycastAll(feet + offset + Vector3.up * .46f, Vector3.down, drop + .46f, ~0, QueryTriggerInteraction.Ignore))
                if (!hit.transform.IsChildOf(transform) && hit.normal.y > .55f && hit.point.y - feet.y <= .45f) return true;
        return false;
    }
    private bool TryStep(Vector3 forward, float maxStride)
    {
        float radius = motor.radius * Mathf.Max(Mathf.Abs(transform.lossyScale.x), Mathf.Abs(transform.lossyScale.z));
        float height = motor.height * Mathf.Abs(transform.lossyScale.y);
        Vector3 feet = Feet;
        foreach (float distance in new[] { .12f, .24f, radius + .08f, radius + .22f })
        {
            var hits = Physics.RaycastAll(feet + forward * distance + Vector3.up * .48f, Vector3.down, .55f, ~0, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (var hit in hits)
            {
                if (hit.transform.IsChildOf(transform) || hit.normal.y < .55f) continue;
                float rise = hit.point.y - feet.y; if (rise < .025f || rise > .45f) continue;
                Vector3 up = Vector3.up * (rise + .025f), stride = forward * Mathf.Min(distance, maxStride);
                if (!Clear(up, radius, height) || !Clear(up + stride, radius, height)) continue;
                // Check the entire raised body sweep, not only the destination.
                Vector3 center = transform.TransformPoint(motor.center) + up; float half = Mathf.Max(0, height * .5f - radius);
                bool blocked = false;
                foreach (var bodyHit in Physics.CapsuleCastAll(center + Vector3.up * half, center - Vector3.up * half, Mathf.Max(.05f, radius - .03f), forward, stride.magnitude, ~0, QueryTriggerInteraction.Ignore))
                    if (!bodyHit.transform.IsChildOf(transform)) { blocked = true; break; }
                if (blocked) continue;
                motor.Move(up); motor.Move(stride); verticalSpeed = -2; return true;
            }
        }
        return false;
    }
    private bool Clear(Vector3 offset, float radius, float height)
    {
        Vector3 center = transform.TransformPoint(motor.center) + offset; float half = Mathf.Max(0, height * .5f - radius);
        foreach (var collider in Physics.OverlapCapsule(center + Vector3.up * half, center - Vector3.up * half, Mathf.Max(.05f, radius - .03f), ~0, QueryTriggerInteraction.Ignore))
            if (!collider.transform.IsChildOf(transform)) return false;
        return true;
    }
    private void OnDisable() { if (motor) motor.enabled = false; if (original) original.enabled = originalEnabled; active = false; }
}
