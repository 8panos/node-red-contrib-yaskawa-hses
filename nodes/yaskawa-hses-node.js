/**
 * Node-RED Node Wrapper for Yaskawa HSES Communication
 * 
 * This module registers the nodes with Node-RED runtime
 */

const { YaskawaHSES } = require('./yaskawa-hses');

module.exports = function(RED) {
    
    /**
     * Yaskawa HSES Communication Node
     * 
     * Main node for communicating with Yaskawa robots via HSES UDP protocol
     */
    function YaskawaHSESNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Get configuration from config node
        const configNode = RED.nodes.getNode(config.config);
        
        // Node state
        node.status({ fill: 'grey', shape: 'ring', text: 'disconnected' });
        
        // Create HSES client
        const clientConfig = {
            host: configNode ? configNode.host : config.host,
            port: configNode ? configNode.port : (config.port || 10040),
            localPort: config.localPort || 0,
            timeout: config.timeout || 5000
        };
        
        node.client = new YaskawaHSES(clientConfig);
        
        // Handle connection events
        node.client.on('connect', () => {
            node.status({ fill: 'green', shape: 'dot', text: 'connected' });
            node.log(`Connected to Yaskawa robot at ${clientConfig.host}:${clientConfig.port}`);
        });
        
        node.client.on('disconnect', () => {
            node.status({ fill: 'grey', shape: 'ring', text: 'disconnected' });
            node.log('Disconnected from Yaskawa robot');
        });
        
        node.client.on('error', (err) => {
            node.status({ fill: 'red', shape: 'ring', text: 'error' });
            node.error(`HSES Error: ${err.message}`);
        });
        
        // Connect on startup if auto-connect is enabled
        if (config.autoConnect !== false) {
            node.client.connect().catch((err) => {
                node.error(`Connection failed: ${err.message}`);
            });
        }
        
        // Handle incoming messages
        node.on('input', async function(msg, send, done) {
            try {
                let result;
                
                // Determine operation from msg.topic or config.operation
                const operation = msg.topic || config.operation || 'read';
                const variableType = msg.variableType || config.variableType || 'B';
                const address = msg.address !== undefined ? msg.address : config.address;
                const values = msg.payload;
                
                switch (operation.toLowerCase()) {
                    case 'read':
                    case 'readb':
                        result = await node.client.readB(address, msg.count || 1);
                        break;
                    case 'readi':
                        result = await node.client.readI(address, msg.count || 1);
                        break;
                    case 'readd':
                        result = await node.client.readD(address, msg.count || 1);
                        break;
                    case 'readr':
                        result = await node.client.readR(address, msg.count || 1);
                        break;
                    case 'write':
                    case 'writeb':
                        result = await node.client.writeB(address, values);
                        break;
                    case 'writei':
                        result = await node.client.writeI(address, values);
                        break;
                    case 'writed':
                        result = await node.client.writeD(address, values);
                        break;
                    case 'writer':
                        result = await node.client.writeR(address, values);
                        break;
                    case 'position':
                    case 'readposition':
                        result = await node.client.readPosition();
                        break;
                    case 'readio':
                        result = await node.client.readIO(address, msg.count || 1);
                        break;
                    case 'writeio':
                        result = await node.client.writeIO(address, values);
                        break;
                    case 'status':
                        result = await node.client.getStatus();
                        break;
                    case 'connect':
                        await node.client.connect();
                        result = { success: true, operation: 'connect' };
                        break;
                    case 'disconnect':
                        await node.client.disconnect();
                        result = { success: true, operation: 'disconnect' };
                        break;
                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }
                
                // Prepare output message
                msg.payload = result;
                msg.stats = node.client.getStats();
                
                send(msg);
                done();
                
            } catch (err) {
                node.error(`Operation failed: ${err.message}`);
                msg.payload = { success: false, error: err.message };
                send(msg);
                done(err);
            }
        });
        
        // Handle node close
        node.on('close', function(done) {
            node.client.disconnect().then(() => {
                done();
            }).catch((err) => {
                node.error(`Disconnect error: ${err.message}`);
                done();
            });
        });
    }
    
    RED.nodes.registerType('yaskawa-hses', YaskawaHSESNode, {
        category: 'industrial',
        color: '#C0DEED',
        defaults: {
            name: { value: '' },
            config: { type: 'yaskawa-hses-config', required: true },
            operation: { value: 'read', required: true },
            variableType: { value: 'B' },
            address: { value: 0, validate: RED.validators.number() },
            autoConnect: { value: true },
            timeout: { value: 5000, validate: RED.validators.number() }
        },
        inputs: 1,
        outputs: 1,
        icon: 'yaskawa.png',
        label: function() {
            return this.name || 'Yaskawa HSES';
        },
        labelStyle: function() {
            return this.name ? 'node_label_italic' : '';
        }
    });
    
    /**
     * Yaskawa HSES Configuration Node
     * 
     * Stores connection configuration
     */
    function YaskawaHSESConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        this.host = config.host;
        this.port = config.port || 10040;
        this.localPort = config.localPort || 0;
    }
    
    RED.nodes.registerType('yaskawa-hses-config', YaskawaHSESConfigNode, {
        category: 'config',
        defaults: {
            name: { value: '' },
            host: { value: '192.168.1.100', required: true },
            port: { value: 10040, required: true, validate: RED.validators.number() },
            localPort: { value: 0, validate: RED.validators.number() }
        },
        label: function() {
            return this.name || `${this.host}:${this.port}`;
        }
    });
};
