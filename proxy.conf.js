/**
 * For more configuration, please refer to https://angular.io/guide/build#proxying-to-a-backend-server
 *
 * 更多配置描述请参考 https://angular.cn/guide/build#proxying-to-a-backend-server
 *
 * Note: The proxy is only valid for real requests, Mock does not actually generate requests, so the priority of Mock will be higher than the proxy
 */
module.exports = {
  '/dev/ws': {
    target: 'http://127.0.0.1:3010',
    secure: false,
    ws: true,
    pathRewrite: {
      '^/dev/ws$': '/api/ws',
    },
    changeOrigin: true,
  },
  '/api/ws': {
    target: 'https://datasync.navfirst.com',
    secure: false,
    ws: true,
    changeOrigin: true,
  },
  '/api/': {
    target: 'https://datasync.navfirst.com/api/',
    secure: false,
    pathRewrite: {
      '^/api/': '',
    },
    changeOrigin: true,
  },
  '/dev/': {
    target: 'http://127.0.0.1:3010/api/',
    secure: false,
    pathRewrite: {
      '^/dev/': '',
    },
    changeOrigin: true,
  },
};
