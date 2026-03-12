# Node-RED Contrib Yaskawa HSES

安川机器人 HSES UDP 通讯节点 - 用于 Node-RED 的工业级通讯解决方案

## 功能特性

- ✅ **原生 UDP 通讯** - 基于 Node.js 原生 `dgram` 模块，零第三方依赖
- ✅ **完整协议封装** - 自动处理 YERC 报文头、数据高低位转换
- ✅ **可视化配置** - 友好的配置界面，支持 IP、端口、超时等参数设置
- ✅ **变量读写** - 支持 B/I/D/R 类型变量的读写操作
- ✅ **位置读取** - 实时读取机器人位置 (X, Y, Z, RX, RY, RZ)
- ✅ **IO 控制** - 支持数字 IO 的读写控制
- ✅ **状态监视** - 实时监视机器人运行状态
- ✅ **自动重连** - 支持连接断开自动重连机制
- ✅ **完整日志** - 详细的通讯日志和统计信息

## 安装

```bash
cd ~/.node-red
npm install /path/to/node-red-contrib-yaskawa-hses
```

或者从 GitHub 安装：

```bash
cd ~/.node-red
npm install git+https://github.com/yourusername/node-red-contrib-yaskawa-hses.git
```

## 使用方法

### 1. 配置连接

1. 从节点面板拖拽 **"yaskawa-hses-config"** 配置节点到工作区
2. 双击配置节点，设置：
   - **机器人 IP**: 安川机器人的 IP 地址（如 192.168.1.100）
   - **HSES 端口**: 默认 10040
   - **本地端口**: 0 表示自动分配

### 2. 添加通讯节点

1. 从节点面板拖拽 **"yaskawa-hses"** 节点到工作区
2. 双击节点，选择刚才创建的配置
3. 设置操作类型：
   - **读取变量**: 读取 B/I/D/R 变量
   - **写入变量**: 写入 B/I/D/R 变量
   - **读取位置**: 读取机器人当前位置
   - **读取 IO**: 读取 IO 状态
   - **写入 IO**: 写入 IO 值
   - **读取状态**: 读取机器人运行状态

### 3. 示例流程

#### 读取 B 变量

```javascript
// 注入节点配置
msg.topic = "read";
msg.variableType = "B";
msg.address = 100;
msg.count = 5;
return msg;
```

#### 写入 I 变量

```javascript
// 注入节点配置
msg.topic = "write";
msg.variableType = "I";
msg.address = 200;
msg.payload = 1234;
return msg;
```

#### 读取机器人位置

```javascript
// 注入节点配置
msg.topic = "readposition";
return msg;

// 输出示例：
// {
//   "success": true,
//   "position": {
//     "x": 100.5,
//     "y": 200.3,
//     "z": 50.0,
//     "rx": 0,
//     "ry": 0,
//     "rz": 90
//   }
// }
```

#### 读取机器人状态

```javascript
// 注入节点配置
msg.topic = "status";
return msg;

// 输出示例：
// {
//   "success": true,
//   "status": {
//     "running": true,
//     "error": false,
//     "servoOn": true,
//     "ready": true,
//     "mode": 1,
//     "step": 10,
//     "speed": 50
//   }
// }
```

## 节点说明

### yaskawa-hses-config (配置节点)

存储安川机器人的连接配置信息。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| host | string | 192.168.1.100 | 机器人 IP 地址 |
| port | number | 10040 | HSES 协议端口 |
| localPort | number | 0 | 本地 UDP 端口，0 表示自动分配 |

### yaskawa-hses (通讯节点)

执行具体的通讯操作。

#### 输入

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | 否 | 操作类型，覆盖节点配置 |
| variableType | string | 否 | 变量类型 (B/I/D/R)，覆盖节点配置 |
| address | number | 否 | 变量地址，覆盖节点配置 |
| count | number | 否 | 读取数量，默认为 1 |
| payload | array/number | 否 | 写入的数据值 |

#### 输出

| 属性 | 类型 | 说明 |
|------|------|------|
| payload | object | 操作结果 |
| stats | object | 通讯统计信息 |

#### 操作类型

| 类型 | 说明 | 示例 |
|------|------|------|
| read | 读取变量 | `msg.topic = "read"` |
| write | 写入变量 | `msg.topic = "write"` |
| readposition | 读取位置 | `msg.topic = "readposition"` |
| readio | 读取 IO | `msg.topic = "readio"` |
| writeio | 写入 IO | `msg.topic = "writeio"` |
| status | 读取状态 | `msg.topic = "status"` |
| connect | 连接 | `msg.topic = "connect"` |
| disconnect | 断开连接 | `msg.topic = "disconnect"` |

## HSES 协议说明

### YERC 报文头结构 (32 字节)

```
Offset | Size | Description
-------|------|------------
0      | 4    | Header ID (ASCII: "YERC")
4      | 4    | Header size (0x0020 = 32)
8      | 4    | Reserved
12     | 2    | Command type
14     | 2    | Command data size
16     | 4    | Reserved
20     | 4    | Request ID
24     | 4    | Reserved
28     | 4    | Block number
```

### 命令类型

| 命令 | 值 | 说明 |
|------|-----|------|
| CMD_READ_B | 0x01 | 读取位变量 |
| CMD_READ_I | 0x02 | 读取整型变量 |
| CMD_READ_D | 0x03 | 读取双字变量 |
| CMD_READ_R | 0x04 | 读取浮点变量 |
| CMD_WRITE_B | 0x11 | 写入位变量 |
| CMD_WRITE_I | 0x12 | 写入整型变量 |
| CMD_WRITE_D | 0x13 | 写入双字变量 |
| CMD_WRITE_R | 0x14 | 写入浮点变量 |
| CMD_READ_POS | 0x20 | 读取机器人位置 |
| CMD_READ_IO | 0x30 | 读取 IO 状态 |
| CMD_WRITE_IO | 0x31 | 写入 IO |
| CMD_STATUS | 0x40 | 读取机器人状态 |

### 数据格式

所有数据均采用 **大端序 (Big-endian)** 编码。

## 开发

### 项目结构

```
node-red-contrib-yaskawa-hses/
├── nodes/
│   ├── yaskawa-hses.js       # 核心通讯逻辑
│   ├── yaskawa-hses-node.js  # Node-RED 节点包装
│   └── yaskawa-hses.html     # 配置界面
├── test/
│   └── test-hses.js          # 单元测试
├── package.json
└── README.md
```

### 运行测试

```bash
npm test
```

### 调试模式

在 Node-RED 设置中启用调试日志：

```javascript
// settings.js
logging: {
    console: {
        level: "debug"
    }
}
```

## 故障排除

### 连接失败

1. 检查机器人 IP 地址是否正确
2. 确认 HSES 功能已在机器人上启用
3. 检查网络连接和防火墙设置
4. 确认端口 10040 未被占用

### 通讯超时

1. 增加超时时间设置
2. 检查网络延迟
3. 确认机器人响应正常

### 数据错误

1. 检查变量地址是否正确
2. 确认变量类型匹配
3. 查看错误代码说明

## 错误代码

| 代码 | 说明 |
|------|------|
| 0x0001 | 无效命令 |
| 0x0002 | 无效地址 |
| 0x0003 | 无效数据大小 |
| 0x0004 | 读取不允许 |
| 0x0005 | 写入不允许 |
| 0x0006 | 机器人错误状态 |
| 0x0007 | 伺服关闭 |
| 0x0008 | 超时 |
| 0x0009 | 通讯错误 |
| 0x000A | 忙碌 |

## 安全注意事项

⚠️ **警告**:

1. UDP 协议是无连接的，不保证数据可靠性
2. 在生产环境中建议添加数据校验和重试机制
3. 确保网络安全，防止未授权访问
4. 操作机器人前确保安全防护装置正常工作
5. 建议在测试环境中充分验证后再部署到生产环境

## 许可证

MIT License

## 作者

张鹏 - 工业机器人技术开发

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0 (2026-03-10)

- 初始版本发布
- 支持 HSES UDP 协议通讯
- 支持 B/I/D/R 变量读写
- 支持位置读取和 IO 控制
- 支持状态监视
