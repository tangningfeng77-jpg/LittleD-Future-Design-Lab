from pathlib import Path
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');section='''## 自然交流与质感优化

默认界面已改为机器人 + 对话区。原来的动作、表情与组件编辑工具折叠到右上角「编辑外观」中，资源没有删掉。

- 说话不再显示波形嘴：原嘴部网格改用弧形嘴，按实际播放音频的响度轻微开合；安静后平滑闭合。这是音量驱动的动画，不是逐音素口型。
- 小D根据自己的流式回复安排表情与动作。`public/expression.js` 负责本地语义提示、播放时钟、节奏限制与取消；模型也可通过原有动作工具给出明确表达。问候、鼓励、安慰、不确定等有默认表现，普通介绍使用轻微讲述动作。语音结束回到待机；打断清空未播放的动作。
- 流式开头的「哇、啊」不会马上抢占整句话的表情。短句中的动作会去重，避免连续抖动。自动表情不写入外观偏好。
- `public/mouth.js` 绘制嘴型。`voice.js` 的播放 AnalyserNode 提供音量，口型与实际播放而非网络包到达时刻关联。
- 保留原身体网格、比例、骨骼和全部动画，细化附件几何圆角；白色外壳与面罩改用涂层材质，铜件与石墨部件采用不同粗糙度和金属度。
- 增加本地生成的摄影棚反射环境、暖主光、冷补光、轮廓光、柔化实时阴影、轮子接触阴影与自然眨眼。仅增加中性拍摄背景，不恢复展厅。

验证：`node tools/verify-expression.mjs` 检查流式分段、重复动作限制、语音时钟安排、鼓励表情、打断取消。浏览器实测普通聊天「今天我的作品终于完成了，我很开心！」，小D自行回复祝贺，并触发开心与 EmoThumbsUp；无需点击动作按钮。页面无运行时错误。麦克风与摄像头仍需用户本人授权。

''';s=s.replace('## 启动\n',section+'## 启动\n',1);p.write_text(s,encoding='utf8')
# Remove only temporary one-off editing helpers created in this turn.
root=Path('robot-html/tools').resolve()
for name in ['refine-robot.py','refine-voice.py','refine-details.py','fix-expression.py','finish-expression.py','expression-balance.py','final-polish.py','expression-filler.py','fix-expression-test.py','expression-stream.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
