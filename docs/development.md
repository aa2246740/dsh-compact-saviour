# 开发与验证

用户安装请看 [README](../README.md#安装)。本页只面向修改源码的贡献者；这里的构建工具不参与普通插件安装。

1. 准备与目标版本匹配、已安装依赖的 DeepSeek Harness 0.2.0-rc.1 checkout，以及外部客户端构建适配器 `tools/dshx/src/client-build.js`。适配器生成官方 lazy-CJS 客户端格式。DSHX 0.9.2 使用 git 分支 `cursor/harness-020-rc1-ce8f`（`ea2c8777644c27646b280f675aac7c712cf6748c`），不要用 npm 上的旧 dshx。
2. 在本插件目录链接开发依赖并构建；所有输出只写入本插件，官方 Harness 只读。

```sh
export DSHX_HARNESS=/path/to/prepared-harness-checkout
node scripts/link-harness-dependencies.mjs "$DSHX_HARNESS"
npm run typecheck
npm test
npm run build
npm pack --ignore-scripts
```

`npm run build` 最后只移除生成文件注释中的机器绝对路径，不改运行代码。发布包预先带有构建结果，不设置 install/prepare/postinstall 脚本。

浏览器回归使用已固定的 Playwright 1.61.1 / Chromium Headless Shell 1228，运行时位置为 `~/.codex/playwright-runtime/runtime.mjs`。没有该测试环境时不要把浏览器测试标记为已通过。

```sh
npm run test:browser
COMPACT_LAYOUT=legacy node tests/interaction.browser.mjs
```

测试只使用本地 mock adapter 和假压缩接口，不连接真实模型。覆盖自动救援、事务、旧版内联弹窗与 RC2 body portal、按钮/键盘/长按、取消、动画及卸载。

安装自建包仍使用 README 中的官方插件管理器或 `dsh plugin --profile web add file:./dsh-compact-saviour`，不需要向 Harness 源码目录写入任何文件。
