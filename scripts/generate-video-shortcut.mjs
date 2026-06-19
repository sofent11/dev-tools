import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'components/tools/VideoDownloader.tsx');
const source = readFileSync(sourcePath, 'utf8');
const endpointMatch = source.match(/export const DEFAULT_WORKER_ENDPOINT = '([^']+)'/);

if (!endpointMatch) {
  throw new Error('Unable to read DEFAULT_WORKER_ENDPOINT from VideoDownloader.tsx');
}

const defaultWorkerEndpoint = endpointMatch[1].replace(/\/+$/, '');
const outputDir = join(root, 'public/shortcuts');
const outputPath = join(outputDir, 'video-catch-default-worker.shortcut');
const unsignedJsonPath = join(outputDir, '.video-catch-default-worker.json');
const unsignedShortcutPath = join(outputDir, '.video-catch-default-worker.unsigned.shortcut');
const shortcutName = '视频下载解析器';
const objectReplacement = '\ufffc';

const actionOutput = (outputName) => ({
  Value: {
    OutputUUID: randomUUID().toUpperCase(),
    OutputName: outputName,
    Type: 'ActionOutput',
  },
  WFSerializationType: 'WFTextTokenAttachment',
});

const textToken = (strings, ...variables) => {
  let cursor = 0;
  const attachmentsByRange = {};
  const chunks = [];

  strings.forEach((chunk, index) => {
    chunks.push(chunk);
    cursor += chunk.length;

    const nextVariable = variables[index];
    if (!nextVariable) return;

    chunks.push(objectReplacement);
    attachmentsByRange[`{${cursor}, 1}`] = nextVariable.Value;
    cursor += 1;
  });

  return {
    Value: {
      string: chunks.join(''),
      attachmentsByRange,
    },
    WFSerializationType: 'WFTextTokenString',
  };
};

const withOutput = (action, output) => {
  action.WFWorkflowActionParameters.UUID = output.Value.OutputUUID;
  action.WFWorkflowActionParameters.CustomOutputName = output.Value.OutputName;
  return action;
};

const action = (identifier, parameters = {}, output) => {
  const nextAction = {
    WFWorkflowActionIdentifier: identifier,
    WFWorkflowActionParameters: parameters,
  };
  return output ? withOutput(nextAction, output) : nextAction;
};

const urlList = actionOutput('输入链接');
const firstUrl = actionOutput('第一个链接');
const encodedUrl = actionOutput('编码链接');
const apiUrl = actionOutput('Worker API');
const workerResponse = actionOutput('Worker 响应');
const responseDictionary = actionOutput('响应字典');
const formats = actionOutput('候选格式');
const firstFormat = actionOutput('第一个候选格式');
const videoUrl = actionOutput('视频直链');
const videoFile = actionOutput('视频文件');

const workflow = {
  WFWorkflowClientVersion: '3100.0.4',
  WFWorkflowClientRelease: '6.0',
  WFWorkflowHasOutputFallback: false,
  WFWorkflowIcon: {
    WFWorkflowIconStartColor: 4274264319,
    WFWorkflowIconGlyphNumber: 59719,
  },
  WFWorkflowImportQuestions: [],
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  WFWorkflowName: shortcutName,
  WFWorkflowTypes: ['ActionExtension'],
  WFWorkflowInputContentItemClasses: [
    'WFSafariWebPageContentItem',
    'WFURLContentItem',
    'WFStringContentItem',
  ],
  WFWorkflowOutputContentItemClasses: ['WFURLContentItem', 'WFStringContentItem'],
  WFWorkflowActions: [
    action('is.workflow.actions.comment', {
      WFCommentActionText: `从分享表单接收视频页面链接，调用默认 Worker ${defaultWorkerEndpoint}/api/extract，自动下载第一个候选视频地址并保存到系统相册。`,
    }),
    action('is.workflow.actions.detect.link', {}, urlList),
    action('is.workflow.actions.getitemfromlist', {
      WFItemSpecifier: 'First Item',
    }, firstUrl),
    action('is.workflow.actions.urlencode', {
      WFEncodeMode: 'Encode',
    }, encodedUrl),
    action('is.workflow.actions.gettext', {
      WFTextActionText: textToken`${defaultWorkerEndpoint}/api/extract?url=${encodedUrl}`,
    }, apiUrl),
    action('is.workflow.actions.downloadurl', {
      WFHTTPMethod: 'GET',
      Advanced: false,
      ShowHeaders: false,
    }, workerResponse),
    action('is.workflow.actions.detect.dictionary', {}, responseDictionary),
    action('is.workflow.actions.getvalueforkey', {
      WFDictionaryKey: 'formats',
      WFGetDictionaryValueType: 'Value',
    }, formats),
    action('is.workflow.actions.getitemfromlist', {
      WFItemSpecifier: 'First Item',
    }, firstFormat),
    action('is.workflow.actions.getvalueforkey', {
      WFDictionaryKey: 'url',
      WFGetDictionaryValueType: 'Value',
    }, videoUrl),
    action('is.workflow.actions.downloadurl', {
      WFHTTPMethod: 'GET',
      Advanced: false,
      ShowHeaders: false,
    }, videoFile),
    action('is.workflow.actions.savetocameraroll', {
      WFCameraRollSelectedGroup: 'Recents',
    }),
    action('is.workflow.actions.notification', {
      WFNotificationActionTitle: '视频已保存到相册',
      WFNotificationActionBody: '已使用默认 Worker 解析并保存第一个候选视频。',
      WFNotificationActionSound: true,
    }),
  ],
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(unsignedJsonPath, JSON.stringify(workflow, null, 2));
execFileSync('plutil', ['-convert', 'binary1', '-o', unsignedShortcutPath, '--', unsignedJsonPath], { stdio: 'inherit' });
execFileSync('shortcuts', ['sign', '--mode', 'anyone', '--input', unsignedShortcutPath, '--output', outputPath], { stdio: 'inherit' });
chmodSync(outputPath, 0o644);
rmSync(unsignedJsonPath, { force: true });
rmSync(unsignedShortcutPath, { force: true });

console.log(`Generated ${outputPath}`);
