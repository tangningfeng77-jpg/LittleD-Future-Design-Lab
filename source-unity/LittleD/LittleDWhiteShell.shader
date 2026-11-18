Shader "Exhibition/LittleDWhiteShell"
{
    Properties
    {
        _Color ("Shell White", Color) = (1,1,1,1)
        _MainTex ("Surface Details", 2D) = "white" {}
        _BumpMap ("Normal", 2D) = "bump" {}
        _BumpScale ("Normal Strength", Range(0,2)) = 1
        _EmissionMap ("Status Lights", 2D) = "black" {}
        [HDR] _EmissionColor ("Status Light Color", Color) = (0.1,0.8,0.65,1)
        _ShellFill ("Soft White Fill", Range(0,0.4)) = 0.17
        _Glossiness ("Smoothness", Range(0,1)) = 0.3
        _Metallic ("Metallic", Range(0,1)) = 0.05
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        sampler2D _MainTex, _BumpMap, _EmissionMap;
        fixed4 _Color, _EmissionColor;
        half _Glossiness, _Metallic, _BumpScale, _ShellFill;
        struct Input { float2 uv_MainTex; float2 uv_BumpMap; float2 uv_EmissionMap; };
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            fixed3 details = tex2D(_MainTex, IN.uv_MainTex).rgb;
            half shellMask = smoothstep(0.3, 0.8, dot(details, half3(0.299,0.587,0.114)));
            fixed3 white = lerp(details, fixed3(1,1,1), shellMask * 0.7) * _Color.rgb;
            o.Albedo = white;
            o.Normal = UnpackNormal(tex2D(_BumpMap, IN.uv_BumpMap));
            o.Normal.xy *= _BumpScale;
            o.Normal = normalize(o.Normal);
            o.Metallic = _Metallic;
            o.Smoothness = _Glossiness;
            o.Emission = tex2D(_EmissionMap, IN.uv_EmissionMap).rgb * _EmissionColor.rgb + white * shellMask * _ShellFill;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Standard"
}
