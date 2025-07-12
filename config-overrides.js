const { override } = require('customize-cra');
const webpack = require('webpack');

module.exports = override(
  // Force webpack to use relative paths instead of absolute paths
  function(config) {
    // Change the output path configuration to use relative paths
    config.output.publicPath = './';
    
    // Use relative paths for chunks
    if (config.optimization && config.optimization.splitChunks) {
      config.optimization.runtimeChunk = 'single';
    }
    
    // Force use of relative paths for assets
    if (config.plugins) {
      config.plugins.forEach(plugin => {
        if (plugin.constructor.name === 'MiniCssExtractPlugin') {
          plugin.options.publicPath = './';
        }
        if (plugin.constructor.name === 'HtmlWebpackPlugin') {
          if (!plugin.userOptions) plugin.userOptions = {};
          plugin.userOptions.publicPath = './';
        }
      });
    }
    
    // Log the config options for debugging
    console.log("Webpack publicPath:", config.output.publicPath);
    
    return config;
  },
  
  // Add webpack define plugin to set runtime variables
  function(config) {
    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.RUNNING_IN_ELECTRON': JSON.stringify(true),
      })
    );
    return config;
  }
);
