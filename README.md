# dsh-compact-saviour

[![npm version](https://img.shields.io/npm/v/dsh-compact-saviour)](https://www.npmjs.com/package/dsh-compact-saviour)

给 DeepSeek Harness 增加独立模型自动压缩、长按压缩和一键手动压缩。当前适配的 Host：DSH `0.2.0-rc.2`。

## 安装 / 更新

需要 DeepSeek Harness **0.2.0-rc.2**（`@deepseek-ai/dsh-*` peer `>=0.2.0-rc.1 <0.2.1`，与 DSHX 写在 `@deepseek-ai/dsh` 上的范围相同）。这是符合官方 `dsh.bundle.patch` 约定的外部插件，npm 包包含编译好的 `lib/`。**安装不需要 dshx、Creator Mode、Harness 源码或本地构建。**

### 在 DeepSeek Harness 网页版或桌面端安装

在 **添加插件** 向导的搜索框中填入 `dsh-compact-saviour`，点击 **Install**：

![Add plugin wizard](https://raw.githubusercontent.com/aa2246740/dsh-compact-saviour/main/docs/add-plugin-wizard.png)

安装到当前应用所用的 profile，按安装结果给出的提示完成启用或重新打开应用。然后打开 **设置 → Compact Saviour**，选择已经配置的压缩模型并保存。

### 使用 `dsh` 命令行安装

从 [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) 安装 [`dsh-compact-saviour`](https://www.npmjs.com/package/dsh-compact-saviour) 插件：

```sh
dsh plugin --profile web add dsh-compact-saviour
```

更新 `dsh-compact-saviour` 插件：

```sh
dsh plugin --profile web update dsh-compact-saviour@latest
```

然后用 `dsh web` 启动 Web 界面。无需构建、无需重启。

没有全局 `dsh` 命令时：`npx @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add dsh-compact-saviour`。

CLI 路径需要 Node.js 24+、Git 及 PATH 中的 pnpm。它只写入 `web` profile，不能修改桌面应用的 profile；桌面端请使用上面的应用内“添加插件”向导。不要在同一个 DSH_HOME 上另开一个 Host。

### 高级安装方式

固定到某个 GitHub 标签：

```sh
dsh plugin --profile web add github:aa2246740/dsh-compact-saviour#v0.2.6
```

本地目录（开发/本地测试）：

```sh
dsh plugin --profile web add file:/path/to/dsh-compact-saviour
```

这条路径同样使用官方插件安装器，不需要解压或手动创建软链接。

### 卸载

卸载请使用应用插件页面；Web CLI 对应：

```sh
dsh plugin --profile web remove dsh-compact-saviour
```

卸载后使用官方压缩逻辑，原始会话日志保留。

## 使用

1. 打开 DSH **设置 → Compact Saviour**。
2. 从已经配置的模型中选择压缩模型及 reasoning level，点击保存。
3. **长按上下文圆环 650 毫秒**直接压缩；短按仍打开原 popup，也可以点击其中的 **手动压缩**。
4. 压缩运行时原位置显示 `Open Bot Motion #7 satellite` 小机器人；排队时静止等待，结束后恢复用量圆环。
5. 等待文案在按钮内每 6 秒轻柔切换，例如“正在压缩”“给下一轮对话腾点空间”“把长对话收拾轻一点”。真实进度另显示为 `2/5`，计数包含合并步骤，位置不会随文案移动。合并时切换到合并文案；系统开启减少动态效果时保持静止，后台页面暂停轮换。

插件不添加第二个圆环或弹层外的快捷按钮。模型首次保持未配置状态，不默认消耗当前会话模型的额度。

默认采用“官方连续失败两次后救援”：自动压缩先由官方处理，连续两次符合条件的失败后，Saviour 静默使用配置模型救援。手动按钮、长按圆环和原生 Compact 命令始终直接使用 Saviour 模型，与自动策略和自动开关无关。设置中可主动选择“直接使用 Saviour 模型”来接管全部自动压缩，或关闭自动辅助。缺少 mode 的旧设置按 rescue 处理；明确保存的模式、已有模型和推理等级保留。失败不会自动换模型；在同一个 popup 中可以重试配置模型、仅本次使用当前会话模型，或者取消。临时使用当前模型不会改写保存的设置，也不会切换会话模型。

会话正在运行时，手动请求排队到下一步开始前；若当前步骤结束后会话直接空闲，则在官方 maintenance 锁内执行。不会中断正在运行的工具。

“失败两次后救援”模式在第二次符合条件的官方压缩失败后自动调用配置模型，不弹确认、不抢焦点、不主动展开 popup。圆环显示压缩状态，手动打开后可看进度；救援成功后返回原调用继续执行。若救援也失败，错误和重试入口留在 popup 中，并停止自动重复救援。原生压缩事件仍会记入会话记录，静默不代表隐藏错误或日志。

## 开发

普通安装不需要编译。需要修改源码时请看 [开发说明](docs/development.md)。

## 压缩方式

- 摘要模型使用独立的系统提示词，转录作为数据输入，不执行历史里的工具、文档指令或嵌入提示。
- 保存目标、最新用户纠正、约束、决定、已验证工作、未完成工作、下一步、关键路径和错误。合并时按时间顺序处理旧摘要及新证据。
- 从压缩模型所属 provider 的元数据读取上下文容量。扣除输出预留、压缩提示词、消息封装和 15% 安全余量，按当前输入估算决定分块数；不固定八块，也不再限制每块 32K。能整段容纳就只调用一次，否则最多同时请求两块，再合并摘要。没有评分、复核或第二模型审核。
- 模型明确返回 `CONTEXT_WINDOW_EXCEEDED` 时，只缩小超限部分并继续处理；其他任务已完成的摘要保留。每条分支最多缩小四次，额度、限流、超时、空摘要和截断不会引发更多拆分调用。原始会话只在最终摘要通过事务校验后替换。
- 摘要预算结合目标会话模型、固定提示及工具、输出预留和保留消息计算。分块摘要使用同一预算保留细节，不再统一压到 2,200 tokens。输入长度是多语言保守估算，当前 DSH 元数据接口未提供逐模型 tokenizer，不能把估算当作精确计数或把声明窗口当作摘要质量保证。
- 最近消息按 token 预算原样保留，不切断工具调用与结果配对。原始会话日志保留，仅替换模型下次看到的会话表面。
- 空输出、截断、最终摘要未缩短、会话变化或实际空间不足均拒绝写入。分块建议长度是软目标；中文摘要稍长仍进入有界合并，小分块未缩短则保留该块原文参加合并。没有额外模型复核。多次摘要调用不伪装成原对话模型的一次调用。
- 预算使用当前工作模型的消息计量、实际工具定义和输出预留，不把 provider 用量与消息估计的差额当作固定开销。完成状态里的前后数值是当前消息和工具的估算。
- 0.1.2 会排除明显异常的历史用量：用量锚点超过该模型容量的 110%，且当前消息与工具估算低于容量的 75% 时，圆环和自动压缩判断共同改用当前估算，并在弹层注明。正常 provider 校准保留；真正的模型上下文溢出仍进入官方压缩流程。切换模型时按新模型容量重新估算。
- 每次请求最多 2 分钟，整个救援最多 10 分钟。已完成块在进程内有限缓存；失败块和半份摘要不会提交。

## 实现边界

服务端对已激活官方 BasicCompactionEngine 和 TokenMeter 的公开实例方法做可撤销包装，不修改原型、核心源码或预设文件。优先选取会话所在预设作用域的后端；找不到唯一匹配则禁用该会话的手动入口。卸载时只恢复仍归本插件所有的包装。历史消息、provider 用量事件和累计账本保持原样。

救援事务复用固定版本的官方实现副本（`src/vendor/region.ts`，MIT），继续发出官方 `compaction/start`、`compaction/summary`、`compaction/end`，沿用官方配对检查、锁、表面变化检查和持久化。

官方 popup 暂无 footer 或读数插槽，客户端通过 `conversation.input.right` 的隐藏锚点找到附近的官方上下文弹层，将按钮 portal 到它的底部。0.2.5 支持新版位于卡片下方 dock 的圆环和挂载到 body 的独立浮层；只观察当前输入栏、已确认的上下文浮层，以及 body 的直接子节点，不扫描流式消息子树。多个浮层归属不明确时不接管。异常读数修正复用原有文本节点、圆环和进度条，保留原样式及点击行为，停止修正时恢复原控件的最新值。官方 DOM 结构改变后应重新验收，找不到目标不会绘制替代圆环。

## 验证与限制

40 项后端测试通过，覆盖自动救援、分块压缩、失败保护、事务、排队、手动重试、会话模型保持不变及卸载恢复。浏览器回归覆盖新版独立浮层、旧版内联弹窗、按钮/键盘/长按、状态动画、百分比修正和切会话清理。

0.2.5 已在 DSH Studio 0.1.7-rc.2 的真实窗口确认手动入口恢复，并验证客户端热更新；本轮修复测试没有调用模型、没有压缩用户历史，不代表重新测量了摘要质量或模型时延。详细记录见 [ACCEPTANCE.md](ACCEPTANCE.md)。

摘要是有损压缩，可能漏掉细节；原始日志始终保留。官方上下文弹窗暂未提供扩展插槽，本插件使用有边界的 DOM 兼容层。未来 DSH 更改弹窗结构时需要重新验收，不承诺未测试版本兼容。

## 许可证

[MIT](LICENSE)。复用的官方压缩事务和 Open Bot Motion 动画许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
