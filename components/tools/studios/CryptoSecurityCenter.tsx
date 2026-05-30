import React from 'react';
import { Shield, Hash, KeyRound } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const JwtTool = lazyNamed(() => import('../SecurityTools'), 'JwtTool');
const HashTool = lazyNamed(() => import('../SecurityTools'), 'HashTool');
const HmacTool = lazyNamed(() => import('../SecurityTools'), 'HmacTool');
const PasswordGenTool = lazyNamed(() => import('../SecurityTools'), 'PasswordGenTool');
const BasicAuthTool = lazyNamed(() => import('../security'), 'BasicAuthTool');
const CertificateParserTool = lazyNamed(() => import('../security'), 'CertificateParserTool');
const AsymmetricKeyTool = lazyNamed(() => import('../security/AsymmetricKeyTool'), 'AsymmetricKeyTool');

const subTools: SubTool[] = [
  { id: 'jwt', name: 'JWT 解析', description: '载荷与时间声明', icon: Shield, component: JwtTool },
  { id: 'hash', name: 'Hash 生成', description: 'SHA1, SHA256, SHA512', icon: Hash, component: HashTool },
  { id: 'hmac', name: 'HMAC 计算', description: 'HMAC-SHA256 计算', icon: Shield, component: HmacTool },
  { id: 'password', name: '密码生成', description: '高强度随机密码', icon: KeyRound, component: PasswordGenTool },
  { id: 'basic-auth', name: 'Basic Auth 生成器', description: 'Authorization Header', icon: KeyRound, component: BasicAuthTool },
  { id: 'cert-parser', name: '证书密码解析器', description: 'PEM 证书与私钥强度评估', icon: Shield, component: CertificateParserTool },
  { id: 'asymmetric-key', name: '非对称密钥转换', description: 'PEM / JWK / DER 互转与私钥体检', icon: Shield, component: AsymmetricKeyTool },
];

export const CryptoSecurityCenter: React.FC = () => {
  return (
    <TabbedToolbox
      title="加密与安全防护中心"
      description="提供本地安全哈希、JWT 调试、强密码生成及 RSA 私钥/证书分析的一站式安全工具箱"
      tools={subTools}
      defaultTab="jwt"
    />
  );
};
