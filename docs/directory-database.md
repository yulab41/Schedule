# 院内通讯录数据库与导入规范

## 边界

- 本通讯录保存院区、科室、服务点、人员/岗位、位置和多种联系方式，独立于群组成员的 `group_member_contacts`。
- 每次导入形成不可变完整快照。旧快照保留供差异审计和回滚；数据库通过生成列唯一索引保证任一时刻最多一个 `published` 快照。
- 原始号码、短号和来源定位必须原样保存；归一化字段只用于检索。来源疑点使用 `needs_review`，禁止导入器自动改写。
- 后续 API 只向 active `owner`、`administrator`、`member` 和 developer admin 开放；`guest`、访客链接和匿名请求不得读取。DIR-01 只建立数据底座，不实现读取接口。

## 表结构

| 表 | 作用 | 关键约束/索引 |
| --- | --- | --- |
| `directory_campuses` | 稳定院区字典 | 院区 `code` 唯一、显示顺序索引 |
| `directory_import_batches` | 快照版本、来源清单摘要、差异与告警 | `import_version`/manifest SHA-256 唯一；生成列 `published_slot` 唯一 |
| `directory_source_documents` | 每批来源文档元数据，不保存 PDF 文件或本地路径 | 批次内文档 key、SHA-256 唯一；关联院区 |
| `directory_entries` | 可筛选的科室/服务点/人员条目和来源定位 | 批次内 `entry_key`、来源定位唯一；院区/科室/类型/顺序 B-tree；`search_text` ngram FULLTEXT |
| `directory_contact_methods` | 一个条目的长号、短号、传真、热线等多值联系方式 | 保留原值；数字归一化长号/短号前缀索引；同条目内容哈希唯一 |
| `directory_search_aliases` | 原文、人工别名、全拼、紧凑全拼和拼音首字母 | `normalized_value` 前缀索引；同条目别名哈希唯一 |

`entry_key` 是跨快照稳定的业务标识，不包含号码；因此号码变化会被判定为 `changed`，而不是删除后新增。`content_sha256` 覆盖分类、位置、联系方式、别名、可见性和复核状态。

## 标准输入清单 v1

CLI 只从 stdin 接收 JSON，避免真实号码出现在命令行、进程列表或仓库文件中：

```json
{
  "schemaVersion": 1,
  "importVersion": "synthetic-2026-05-12.1",
  "effectiveOn": "2026-05-12",
  "campuses": [
    {
      "code": "synthetic-campus",
      "name": "测试院区",
      "displayOrder": 10
    }
  ],
  "documents": [
    {
      "documentKey": "synthetic-directory",
      "campusCode": "synthetic-campus",
      "title": "合成通讯录",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "effectiveOn": "2026-05-12",
      "pageCount": 1,
      "displayOrder": 10
    }
  ],
  "entries": [
    {
      "entryKey": "synthetic-campus:test-center:switchboard",
      "sourceDocumentKey": "synthetic-directory",
      "sourcePage": 1,
      "sourceLocator": "table:r1:c1",
      "campusCode": "synthetic-campus",
      "section": "行政服务",
      "department": "测试中心",
      "contactName": "测试总机",
      "entryKind": "switchboard",
      "visibility": "member",
      "verificationStatus": "source_exact",
      "displayOrder": 10,
      "aliases": ["测试服务"],
      "contacts": [
        {
          "type": "voice",
          "label": "总机",
          "fullNumber": "(0000) 0000-0000",
          "internalExtension": "1000",
          "isPrimary": true,
          "displayOrder": 10
        }
      ]
    }
  ]
}
```

导入器校验版本、日期、SHA-256、引用、唯一键、页码范围、号码字符/位数和规模上限。错误只返回字段路径，不回显号码；stdout 只输出批次 ID、manifest 哈希、计数、差异和告警类别。

```text
Get-Content manifest.json -Raw | pnpm directory:import -- --stdin --dry-run
Get-Content manifest.json -Raw | pnpm directory:import -- --stdin --publish
pnpm directory:import -- --activate-batch=<uuid>
```

生产导入应通过 SSH stdin 流式传递，不把 manifest 复制到服务器磁盘。发布事务依次写入完整快照、替换当前批次并追加不含号码的审计日志；任一步失败时全部回滚。

## 后续检索组合

1. 先限定唯一 `published` 批次，再应用 `campusId`、科室、楼宇、楼层、类型等结构化过滤。
2. 输入只含数字时，优先匹配 `normalized_full_number`/`normalized_internal_extension` 的精确值和前缀。
3. 输入为中文或拼音时，依次匹配别名精确值、别名前缀、拼音首字母，再使用 `MATCH(search_text) AGAINST (... IN BOOLEAN MODE)` 的 ngram 相关度。
4. 同分结果按来源显示顺序和稳定 ID 排序，使用游标分页；不要用深 offset。

建议的后续 API 排序权重为：号码精确 > 号码前缀 > 原文/别名精确 > 原文/拼音前缀 > ngram 相关度 > 来源顺序。数据量当前很小，无需引入外部搜索集群。

## 依据

- MySQL 8.4 ngram 全文解析器：<https://dev.mysql.com/doc/refman/8.4/en/fulltext-search-ngram.html>
- MySQL B-tree 与列索引：<https://dev.mysql.com/doc/refman/8.4/en/column-indexes.html>
- vCard 组织和电话语义（RFC 6350）：<https://www.rfc-editor.org/rfc/rfc6350.html>
- `pinyin-pro`（MIT，固定为 `3.29.2`）：<https://github.com/zh-lx/pinyin-pro>
