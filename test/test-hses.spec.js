/**
 * Test suite for Yaskawa HSES Protocol
 */

const assert = require('assert');
const { YaskawaHSES, HSESProtocol, YERCHeader, HSES_CONSTANTS } = require('../nodes/yaskawa-hses');

describe('Yaskawa HSES Protocol', function() {
    
    describe('YERC Header', function() {
        it('should pack and unpack header correctly', function() {
            const header = new YERCHeader();
            header.command = 0x01;
            header.dataSize = 4;
            header.requestId = 12345;
            header.blockNumber = 1;
            
            const packed = header.pack();
            assert.strictEqual(packed.length, 32);
            assert.strictEqual(packed.slice(0, 4).toString(), 'YERC');
            
            const unpacked = new YERCHeader().unpack(packed);
            assert.strictEqual(unpacked.command, 0x01);
            assert.strictEqual(unpacked.dataSize, 4);
            assert.strictEqual(unpacked.requestId, 12345);
            assert.strictEqual(unpacked.blockNumber, 1);
        });
        
        it('should throw error for invalid header ID', function() {
            const invalidBuf = Buffer.alloc(32);
            invalidBuf.write('INVALID', 0);
            
            assert.throws(() => {
                new YERCHeader().unpack(invalidBuf);
            }, /Invalid YERC header ID/);
        });
    });
    
    describe('HSES Protocol Commands', function() {
        let protocol;
        
        beforeEach(function() {
            protocol = new HSESProtocol();
        });
        
        it('should create read B command', function() {
            const cmd = protocol.createReadCommand('B', 100, 5);
            assert.strictEqual(cmd.length, 36); // 32 header + 4 data
            
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_B);
            assert.strictEqual(header.dataSize, 4);
        });
        
        it('should create read I command', function() {
            const cmd = protocol.createReadCommand('I', 200, 3);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_I);
        });
        
        it('should create read D command', function() {
            const cmd = protocol.createReadCommand('D', 300, 2);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_D);
        });
        
        it('should create read R command', function() {
            const cmd = protocol.createReadCommand('R', 400, 1);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_R);
        });
        
        it('should create write B command', function() {
            const cmd = protocol.createWriteCommand('B', 100, [1, 2, 3]);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_WRITE_B);
            assert.strictEqual(header.dataSize, 7); // 4 + 3 bytes
        });
        
        it('should create write I command', function() {
            const cmd = protocol.createWriteCommand('I', 200, [1000, 2000]);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_WRITE_I);
            assert.strictEqual(header.dataSize, 8); // 4 + 4 bytes
        });
        
        it('should create write D command', function() {
            const cmd = protocol.createWriteCommand('D', 300, [100000, 200000]);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_WRITE_D);
            assert.strictEqual(header.dataSize, 12); // 4 + 8 bytes
        });
        
        it('should create write R command', function() {
            const cmd = protocol.createWriteCommand('R', 400, [1.5, 2.5, 3.5]);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_WRITE_R);
            assert.strictEqual(header.dataSize, 16); // 4 + 12 bytes
        });
        
        it('should create read position command', function() {
            const cmd = protocol.createReadPositionCommand();
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_POS);
            assert.strictEqual(header.dataSize, 0);
        });
        
        it('should create read IO command', function() {
            const cmd = protocol.createReadIOCommand(1, 8);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_READ_IO);
        });
        
        it('should create write IO command', function() {
            const cmd = protocol.createWriteIOCommand(1, [1, 0, 1, 0]);
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_WRITE_IO);
        });
        
        it('should create status command', function() {
            const cmd = protocol.createStatusCommand();
            const header = new YERCHeader().unpack(cmd);
            assert.strictEqual(header.command, HSES_CONSTANTS.CMD_STATUS);
        });
        
        it('should throw error for unknown variable type', function() {
            assert.throws(() => {
                protocol.createReadCommand('X', 100, 1);
            }, /Unknown variable type/);
        });
    });
    
    describe('Yaskawa HSES Client', function() {
        let client;
        
        beforeEach(function() {
            client = new YaskawaHSES({
                host: '192.168.1.100',
                port: 10040,
                timeout: 1000
            });
        });
        
        afterEach(async function() {
            if (client.connected) {
                await client.disconnect();
            }
        });
        
        it('should initialize with correct configuration', function() {
            assert.strictEqual(client.host, '192.168.1.100');
            assert.strictEqual(client.port, 10040);
            assert.strictEqual(client.timeout, 1000);
            assert.strictEqual(client.connected, false);
        });
        
        it('should track statistics', function() {
            const stats = client.getStats();
            assert.strictEqual(stats.sent, 0);
            assert.strictEqual(stats.received, 0);
            assert.strictEqual(stats.errors, 0);
            assert.strictEqual(stats.timeouts, 0);
        });
        
        it('should reset statistics', function() {
            client.stats.sent = 10;
            client.stats.received = 5;
            client.resetStats();
            
            const stats = client.getStats();
            assert.strictEqual(stats.sent, 0);
            assert.strictEqual(stats.received, 0);
        });
    });
});

// Run tests if executed directly
if (require.main === module) {
    const Mocha = require('mocha');
    const mocha = new Mocha();
    mocha.run(function(failures) {
        process.exitCode = failures ? 1 : 0;
    });
}
