/**
 * Yaskawa HSES Configuration Node
 * 
 * Configuration node for Yaskawa robot HSES UDP communication
 */

module.exports = function(RED) {
    
    function YaskawaHSESConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        this.host = config.host || '192.168.1.100';
        this.port = parseInt(config.port) || 10040;
        this.localPort = parseInt(config.localPort) || 0;
        this.timeout = parseInt(config.timeout) || 5000;
        
        this.log(`Yaskawa HSES config created: ${this.host}:${this.port}`);
    }
    
    RED.nodes.registerType('yaskawa-hses-config', YaskawaHSESConfigNode, {
        category: 'config',
        defaults: {
            name: { value: '' },
            host: { value: '192.168.1.100', required: true },
            port: { value: 10040, required: true },
            localPort: { value: 0 },
            timeout: { value: 5000 }
        },
        label: function() {
            return this.name || this.host + ':' + this.port;
        }
    });
};
