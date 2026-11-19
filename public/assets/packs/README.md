# 小D 知识包

小D 的知识来自几个“包”，清单在 `index.json`：

| 类型 | 说明 | 例子 |
|---|---|---|
| `builtin` | 内置的实验室介绍资料 | `lab`（`../lab-knowledge/knowledge.json`） |
| `remote` | 经本机服务在线读取，令牌只在 `.env.local` | `gooddesign`（好设计馆，`/api/gd`） |
| `local` | 放在本目录的资料包，启动时并入实验室知识检索 | 实验室的其他项目 |

## 加一个实验室项目

1. 新建文件夹 `packs/<id>/`，`id` 只用小写字母、数字和短横线，例如 `ifs`。
2. 放入 `pages.json`，格式与 `lab-knowledge/knowledge.json` 相同：

```json
{
  "source": "IFS 项目介绍-202611.pptx",
  "sourceDate": "2026年11月",
  "pages": [
    {"id": "P01", "title": "项目概述", "path": "IFS / 概述", "text": "……", "imageText": "", "images": ["IFS-01"]}
  ],
  "images": [
    {"id": "IFS-01", "url": "images/01.jpg", "title": "膜组件结构图", "description": "……", "kind": "资料原图"}
  ]
}
```

3. 图片放在 `packs/<id>/images/`，`url` 写相对路径。
4. 在 `index.json` 的 `packs` 里加一行：

```json
{"id": "ifs", "name": "IFS 离子精筛膜", "kind": "local"}
```

重启后，小D 检索实验室资料时会一并检索这个包，回答里能用它的图片。暂时不用的包写 `"enabled": false`。

未公开的资料只放在展厅本机，不要提交到公开仓库。
