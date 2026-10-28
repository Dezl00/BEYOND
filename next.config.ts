import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,serverExternalPackages:['@napi-rs/canvas'],outputFileTracingIncludes:{'/api/desktop/export/pdf':['./public/fonts/arabic.woff2']}};
export default config;
