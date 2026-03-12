/**
 * Node-RED Node for Yaskawa Robot HSES UDP Communication
 * 
 * Features:
 * - Native UDP communication using Node.js dgram module
 * - Automatic YERC header handling
 * - Automatic endianness conversion (Big-endian ↔ Little-endian)
 * - Support for B/I/D/R variable read/write
 * - Robot position reading
 * - IO control and status monitoring
 */

const dgram = require('dgram');
const EventEmitter = require('events');

// HSES Protocol Constants
const HSES_CONSTANTS = {
    DEFAULT_PORT: 10040,
    HEADER_SIZE: 32,
    MAX_BUFFER_SIZE: 65535,
    TIMEOUT_DEFAULT: 5000,
    
    // Command Types
    CMD_READ_B: 0x01,    // Read Bit variable
    CMD_READ_I: 0x02,    // Read Integer variable
    CMD_READ_D: 0x03,    // Read Double-word variable
    CMD_READ_R: 0x04,    // Read Real (float) variable
    CMD_WRITE_B: 0x11,   // Write Bit variable
    CMD_WRITE_I: 0x12,   // Write Integer variable
    CMD_WRITE_D: 0x13,   // Write Double-word variable
    CMD_WRITE_R: 0x14,   // Write Real (float) variable
    CMD_READ_POS: 0x20,  // Read robot position
    CMD_READ_IO: 0x30,   // Read IO status
    CMD_WRITE_IO: 0x31,  // Write IO
    CMD_STATUS: 0x40,    // Read robot status
};

/**
 * YERC Header Structure (32 bytes)
 * 
 * Offset | Size | Description
 * -------|------|------------
 * 0      | 4    | Header ID (ASCII: "YERC")
 * 4      | 4    | Header size (0x0020 = 32)
 * 8      | 1    | Reserved
 * 9      | 1    | Reserved
 * 10     | 1    | Reserved
 * 11     | 1    | Reserved
 * 12     | 2    | Command (CMD_*) 
 * 14     | 2    | Command data size
 * 16     | 4    | Reserved
 * 20     | 4    | Request ID
 * 24     | 4    | Reserved
 * 28     | 4    | Block number
 */
class YERCHeader {
    constructor() {
        this.headerId = Buffer.from('YERC');
        this.headerSize = 32;
        this.reserved1 = Buffer.alloc(4, 0);
        this.command = 0;
        this.dataSize = 0;
        this.reserved2 = Buffer.alloc(4, 0);
        this.requestId = 0;
        this.reserved3 = Buffer.alloc(4, 0);
        this.blockNumber = 0;
    }

    /**
     * Pack header to Buffer
     */
    pack() {
        const buf = Buffer.alloc(HSES_CONSTANTS.HEADER_SIZE);
        
        // Header ID "YERC"
        this.headerId.copy(buf, 0);
        
        // Header size (Big-endian)
        buf.writeUInt16BE(this.headerSize, 4);
        
        // Reserved bytes (8-11)
        this.reserved1.copy(buf, 8);
        
        // Command (Big-endian)
        buf.writeUInt16BE(this.command, 12);
        
        // Data size (Big-endian)
        buf.writeUInt16BE(this.dataSize, 14);
        
        // Reserved (16-19)
        this.reserved2.copy(buf, 16);
        
        // Request ID (Big-endian)
        buf.writeUInt32BE(this.requestId, 20);
        
        // Reserved (24-27)
        this.reserved3.copy(buf, 24);
        
        // Block number (Big-endian)
        buf.writeUInt32BE(this.blockNumber, 28);
        
        return buf;
    }

    /**
     * Unpack Buffer to header
     */
    unpack(buf) {
        if (buf.length < HSES_CONSTANTS.HEADER_SIZE) {
            throw new Error('Buffer too small for YERC header');
        }
        
        // Verify header ID
        const headerId = buf.slice(0, 4).toString();
        if (headerId !== 'YERC') {
            throw new Error(`Invalid YERC header ID: ${headerId}`);
        }
        
        // Header size
        this.headerSize = buf.readUInt16BE(4);
        
        // Reserved
        this.reserved1 = buf.slice(8, 12);
        
        // Command
        this.command = buf.readUInt16BE(12);
        
        // Data size
        this.dataSize = buf.readUInt16BE(14);
        
        // Reserved
        this.reserved2 = buf.slice(16, 20);
        
        // Request ID
        this.requestId = buf.readUInt32BE(20);
        
        // Reserved
        this.reserved3 = buf.slice(24, 28);
        
        // Block number
        this.blockNumber = buf.readUInt32BE(28);
        
        return this;
    }
}

/**
 * HSES Protocol Handler
 */
class HSESProtocol extends EventEmitter {
    constructor() {
        super();
        this.requestIdCounter = 1;
    }

    /**
     * Create read variable command
     */
    createReadCommand(variableType, address, count = 1) {
        const header = new YERCHeader();
        
        switch (variableType.toUpperCase()) {
            case 'B': header.command = HSES_CONSTANTS.CMD_READ_B; break;
            case 'I': header.command = HSES_CONSTANTS.CMD_READ_I; break;
            case 'D': header.command = HSES_CONSTANTS.CMD_READ_D; break;
            case 'R': header.command = HSES_CONSTANTS.CMD_READ_R; break;
            default:
                throw new Error(`Unknown variable type: ${variableType}`);
        }
        
        header.requestId = this.requestIdCounter++;
        
        // Data: address (2 bytes) + count (2 bytes), Big-endian
        const data = Buffer.alloc(4);
        data.writeUInt16BE(address, 0);
        data.writeUInt16BE(count, 2);
        
        header.dataSize = data.length;
        
        return Buffer.concat([header.pack(), data]);
    }

    /**
     * Create write variable command
     */
    createWriteCommand(variableType, address, values) {
        const header = new YERCHeader();
        
        switch (variableType.toUpperCase()) {
            case 'B': header.command = HSES_CONSTANTS.CMD_WRITE_B; break;
            case 'I': header.command = HSES_CONSTANTS.CMD_WRITE_I; break;
            case 'D': header.command = HSES_CONSTANTS.CMD_WRITE_D; break;
            case 'R': header.command = HSES_CONSTANTS.CMD_WRITE_R; break;
            default:
                throw new Error(`Unknown variable type: ${variableType}`);
        }
        
        header.requestId = this.requestIdCounter++;
        
        // Calculate data size based on variable type
        let dataSize = 4; // address (2) + count (2)
        const count = Array.isArray(values) ? values.length : 1;
        
        switch (variableType.toUpperCase()) {
            case 'B': dataSize += count * 1; break;
            case 'I': dataSize += count * 2; break;
            case 'D': dataSize += count * 4; break;
            case 'R': dataSize += count * 4; break;
        }
        
        const data = Buffer.alloc(dataSize);
        data.writeUInt16BE(address, 0);
        data.writeUInt16BE(count, 2);
        
        // Write values
        let offset = 4;
        const vals = Array.isArray(values) ? values : [values];
        
        for (const val of vals) {
            switch (variableType.toUpperCase()) {
                case 'B':
                    data.writeUInt8(val & 0xFF, offset);
                    offset += 1;
                    break;
                case 'I':
                    data.writeUInt16BE(val & 0xFFFF, offset);
                    offset += 2;
                    break;
                case 'D':
                    data.writeUInt32BE(val >>> 0, offset);
                    offset += 4;
                    break;
                case 'R':
                    data.writeFloatBE(val, offset);
                    offset += 4;
                    break;
            }
        }
        
        header.dataSize = data.length;
        
        return Buffer.concat([header.pack(), data]);
    }

    /**
     * Create read position command
     */
    createReadPositionCommand() {
        const header = new YERCHeader();
        header.command = HSES_CONSTANTS.CMD_READ_POS;
        header.requestId = this.requestIdCounter++;
        header.dataSize = 0;
        
        return header.pack();
    }

    /**
     * Create read IO command
     */
    createReadIOCommand(address, count = 1) {
        const header = new YERCHeader();
        header.command = HSES_CONSTANTS.CMD_READ_IO;
        header.requestId = this.requestIdCounter++;
        
        const data = Buffer.alloc(4);
        data.writeUInt16BE(address, 0);
        data.writeUInt16BE(count, 2);
        
        header.dataSize = data.length;
        
        return Buffer.concat([header.pack(), data]);
    }

    /**
     * Create write IO command
     */
    createWriteIOCommand(address, values) {
        const header = new YERCHeader();
        header.command = HSES_CONSTANTS.CMD_WRITE_IO;
        header.requestId = this.requestIdCounter++;
        
        const count = Array.isArray(values) ? values.length : 1;
        const dataSize = 4 + count; // address (2) + count (2) + values
        
        const data = Buffer.alloc(dataSize);
        data.writeUInt16BE(address, 0);
        data.writeUInt16BE(count, 2);
        
        const vals = Array.isArray(values) ? values : [values];
        for (let i = 0; i < vals.length; i++) {
            data.writeUInt8(vals[i] & 0xFF, 4 + i);
        }
        
        header.dataSize = data.length;
        
        return Buffer.concat([header.pack(), data]);
    }

    /**
     * Create status command
     */
    createStatusCommand() {
        const header = new YERCHeader();
        header.command = HSES_CONSTANTS.CMD_STATUS;
        header.requestId = this.requestIdCounter++;
        header.dataSize = 0;
        
        return header.pack();
    }

    /**
     * Parse response
     */
    parseResponse(buf) {
        if (buf.length < HSES_CONSTANTS.HEADER_SIZE) {
            throw new Error('Response buffer too small');
        }
        
        const header = new YERCHeader().unpack(buf);
        const data = buf.slice(HSES_CONSTANTS.HEADER_SIZE);
        
        return {
            header: header,
            data: data,
            command: header.command,
            requestId: header.requestId
        };
    }
}

/**
 * Yaskawa HSES Communication Node
 */
class YaskawaHSES extends EventEmitter {
    constructor(config) {
        super();
        this.config = config || {};
        this.host = this.config.host || '192.168.1.100';
        this.port = this.config.port || HSES_CONSTANTS.DEFAULT_PORT;
        this.localPort = this.config.localPort || 0; // 0 = random available port
        this.timeout = this.config.timeout || HSES_CONSTANTS.TIMEOUT_DEFAULT;
        
        this.socket = null;
        this.connected = false;
        this.protocol = new HSESProtocol();
        this.pendingRequests = new Map();
        
        this.stats = {
            sent: 0,
            received: 0,
            errors: 0,
            timeouts: 0
        };
    }

    /**
     * Connect to Yaskawa robot
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = dgram.createSocket({
                    type: 'udp4',
                    reuseAddr: true
                });

                this.socket.on('error', (err) => {
                    this.emit('error', err);
                    this.stats.errors++;
                    reject(err);
                });

                this.socket.on('message', (msg, rinfo) => {
                    this._handleMessage(msg, rinfo);
                });

                this.socket.on('listening', () => {
                    const address = this.socket.address();
                    this.localPort = address.port;
                    this.connected = true;
                    this.emit('connect');
                    resolve(address);
                });

                this.socket.on('close', () => {
                    this.connected = false;
                    this.emit('disconnect');
                });

                // Bind to local port
                this.socket.bind(this.localPort);

            } catch (err) {
                this.emit('error', err);
                this.stats.errors++;
                reject(err);
            }
        });
    }

    /**
     * Disconnect from robot
     */
    disconnect() {
        return new Promise((resolve) => {
            if (this.socket) {
                this.socket.close(() => {
                    this.connected = false;
                    this.socket = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle incoming message
     */
    _handleMessage(msg, rinfo) {
        try {
            const response = this.protocol.parseResponse(msg);
            
            // Check if this is a response to a pending request
            const requestId = response.requestId;
            const pending = this.pendingRequests.get(requestId);
            
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);
                
                // Parse data based on command type
                const result = this._parseData(response);
                pending.resolve(result);
            }
            
            this.stats.received++;
            this.emit('message', response, rinfo);
            
        } catch (err) {
            this.emit('error', err);
            this.stats.errors++;
        }
    }

    /**
     * Parse response data based on command type
     */
    _parseData(response) {
        const data = response.data;
        const cmd = response.command;
        
        // Check for error response
        if (data.length >= 2) {
            const errorCode = data.readUInt16BE(0);
            if (errorCode !== 0) {
                return {
                    success: false,
                    errorCode: errorCode,
                    error: this._getErrorMessage(errorCode)
                };
            }
        }
        
        const result = {
            success: true,
            command: cmd,
            requestId: response.requestId
        };
        
        // Parse data based on command
        switch (cmd) {
            case HSES_CONSTANTS.CMD_READ_B:
                result.values = this._parseBitData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_READ_I:
                result.values = this._parseIntegerData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_READ_D:
                result.values = this._parseDoubleData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_READ_R:
                result.values = this._parseRealData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_READ_POS:
                result.position = this._parsePositionData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_READ_IO:
                result.io = this._parseIOData(data.slice(2));
                break;
            case HSES_CONSTANTS.CMD_STATUS:
                result.status = this._parseStatusData(data.slice(2));
                break;
            default:
                result.raw = data.slice(2);
        }
        
        return result;
    }

    /**
     * Parse bit data
     */
    _parseBitData(data) {
        const values = [];
        for (let i = 0; i < data.length; i++) {
            values.push(data.readUInt8(i));
        }
        return values;
    }

    /**
     * Parse integer data
     */
    _parseIntegerData(data) {
        const values = [];
        for (let i = 0; i < data.length; i += 2) {
            values.push(data.readUInt16BE(i));
        }
        return values;
    }

    /**
     * Parse double-word data
     */
    _parseDoubleData(data) {
        const values = [];
        for (let i = 0; i < data.length; i += 4) {
            values.push(data.readUInt32BE(i));
        }
        return values;
    }

    /**
     * Parse real (float) data
     */
    _parseRealData(data) {
        const values = [];
        for (let i = 0; i < data.length; i += 4) {
            values.push(data.readFloatBE(i));
        }
        return values;
    }

    /**
     * Parse position data
     */
    _parsePositionData(data) {
        // Position data typically contains multiple axes
        const axes = [];
        for (let i = 0; i < data.length && i < 48; i += 4) {
            axes.push(data.readFloatBE(i));
        }
        return {
            x: axes[0] || 0,
            y: axes[1] || 0,
            z: axes[2] || 0,
            rx: axes[3] || 0,
            ry: axes[4] || 0,
            rz: axes[5] || 0,
            axes: axes
        };
    }

    /**
     * Parse IO data
     */
    _parseIOData(data) {
        const io = [];
        for (let i = 0; i < data.length; i++) {
            const byte = data.readUInt8(i);
            for (let j = 0; j < 8; j++) {
                io.push((byte >> j) & 1);
            }
        }
        return io;
    }

    /**
     * Parse status data
     */
    _parseStatusData(data) {
        return {
            running: (data[0] & 0x01) !== 0,
            error: (data[0] & 0x02) !== 0,
            servoOn: (data[0] & 0x04) !== 0,
            ready: (data[0] & 0x08) !== 0,
            mode: data[1],
            step: data.readUInt16BE(2),
            speed: data.readUInt16BE(4),
            raw: data
        };
    }

    /**
     * Get error message from error code
     */
    _getErrorMessage(code) {
        const errors = {
            0x0001: 'Invalid command',
            0x0002: 'Invalid address',
            0x0003: 'Invalid data size',
            0x0004: 'Read not allowed',
            0x0005: 'Write not allowed',
            0x0006: 'Robot in error state',
            0x0007: 'Servo off',
            0x0008: 'Timeout',
            0x0009: 'Communication error',
            0x000A: 'Busy',
        };
        return errors[code] || `Unknown error: 0x${code.toString(16).padStart(4, '0')}`;
    }

    /**
     * Send command and wait for response
     */
    _sendCommand(buffer, timeout = this.timeout) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.socket) {
                reject(new Error('Not connected'));
                return;
            }
            
            // Extract request ID from buffer
            const requestId = buffer.readUInt32BE(20);
            
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                this.stats.timeouts++;
                reject(new Error(`Request ${requestId} timeout`));
            }, timeout);
            
            // Store pending request
            this.pendingRequests.set(requestId, {
                resolve: resolve,
                reject: reject,
                timeout: timeoutId
            });
            
            // Send data
            this.socket.send(buffer, this.port, this.host, (err) => {
                if (err) {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(requestId);
                    this.stats.errors++;
                    reject(err);
                } else {
                    this.stats.sent++;
                }
            });
        });
    }

    // Public API methods

    /**
     * Read B variable
     */
    async readB(address, count = 1) {
        const buffer = this.protocol.createReadCommand('B', address, count);
        return await this._sendCommand(buffer);
    }

    /**
     * Read I variable
     */
    async readI(address, count = 1) {
        const buffer = this.protocol.createReadCommand('I', address, count);
        return await this._sendCommand(buffer);
    }

    /**
     * Read D variable
     */
    async readD(address, count = 1) {
        const buffer = this.protocol.createReadCommand('D', address, count);
        return await this._sendCommand(buffer);
    }

    /**
     * Read R variable
     */
    async readR(address, count = 1) {
        const buffer = this.protocol.createReadCommand('R', address, count);
        return await this._sendCommand(buffer);
    }

    /**
     * Write B variable
     */
    async writeB(address, values) {
        const buffer = this.protocol.createWriteCommand('B', address, values);
        return await this._sendCommand(buffer);
    }

    /**
     * Write I variable
     */
    async writeI(address, values) {
        const buffer = this.protocol.createWriteCommand('I', address, values);
        return await this._sendCommand(buffer);
    }

    /**
     * Write D variable
     */
    async writeD(address, values) {
        const buffer = this.protocol.createWriteCommand('D', address, values);
        return await this._sendCommand(buffer);
    }

    /**
     * Write R variable
     */
    async writeR(address, values) {
        const buffer = this.protocol.createWriteCommand('R', address, values);
        return await this._sendCommand(buffer);
    }

    /**
     * Read robot position
     */
    async readPosition() {
        const buffer = this.protocol.createReadPositionCommand();
        return await this._sendCommand(buffer);
    }

    /**
     * Read IO
     */
    async readIO(address, count = 1) {
        const buffer = this.protocol.createReadIOCommand(address, count);
        return await this._sendCommand(buffer);
    }

    /**
     * Write IO
     */
    async writeIO(address, values) {
        const buffer = this.protocol.createWriteIOCommand(address, values);
        return await this._sendCommand(buffer);
    }

    /**
     * Get robot status
     */
    async getStatus() {
        const buffer = this.protocol.createStatusCommand();
        return await this._sendCommand(buffer);
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            sent: 0,
            received: 0,
            errors: 0,
            timeouts: 0
        };
    }
}

module.exports = {
    YaskawaHSES,
    HSESProtocol,
    YERCHeader,
    HSES_CONSTANTS
};
