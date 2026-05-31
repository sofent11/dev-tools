import React from 'react';
import { Hash, KeyRound, Shield } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const JwtTool = lazyNamed(() => import('../SecurityTools'), 'JwtTool');
const HashTool = lazyNamed(() => import('../SecurityTools'), 'HashTool');
const HmacTool = lazyNamed(() => import('../SecurityTools'), 'HmacTool');
const PasswordGenTool = lazyNamed(() => import('../SecurityTools'), 'PasswordGenTool');
const BasicAuthTool = lazyNamed(() => import('../security'), 'BasicAuthTool');
const CertificateParserTool = lazyNamed(() => import('../security'), 'CertificateParserTool');
const AsymmetricKeyTool = lazyNamed(() => import('../security/AsymmetricKeyTool'), 'AsymmetricKeyTool');
const PgpKeymasterTool = lazyNamed(() => import('../SecurityTools'), 'PgpKeymasterTool');
const SmCryptoSuiteTool = lazyNamed(() => import('../SecurityTools'), 'SmCryptoSuiteTool');

const subTools: SubTool[] = [
  { id: 'jwt', name: 'JWT 解析', description: '载荷与时间声明', icon: Shield, component: JwtTool },
  { id: 'hash', name: 'Hash 生成', description: 'SHA1, SHA256, SHA512', icon: Hash, component: HashTool },
  { id: 'hmac', name: 'HMAC 计算', description: 'HMAC-SHA256 计算', icon: Shield, component: HmacTool },
  { id: 'password', name: '密码生成', description: '高强度随机密码与强度审计', icon: KeyRound, component: PasswordGenTool },
  { id: 'basic-auth', name: 'Basic Auth 生成器', description: 'Authorization Header', icon: KeyRound, component: BasicAuthTool },
  { id: 'cert-parser', name: '证书密码解析器', description: 'PEM 证书与私钥强度评估与一致性配对', icon: Shield, component: CertificateParserTool },
  { id: 'asymmetric-key', name: '非对称密钥转换', description: 'PEM / JWK / DER 互转与私钥体检', icon: Shield, component: AsymmetricKeyTool },
  { id: 'pgp-keymaster', name: 'GPG / PGP 密钥中心', description: '离线 GPG 密钥对生成与加解密', icon: Shield, component: PgpKeymasterTool },
  { id: 'sm-crypto', name: '国密算法套件 (SM2/3/4)', description: '中国商用国密离线加密/签名/哈希套件', icon: Shield, component: SmCryptoSuiteTool },
];

export const SecurityKeyStudio: React.FC = () => (
  <TabbedToolbox
    title="安全、令牌与密钥工作室"
    description="围绕令牌检查、摘要认证、密码生成、证书私钥和离线加密组织敏感开发辅助工具"
    tools={subTools}
    defaultTab="jwt"
  />
);
