// 등록된 프레임워크 감지기. 새 감지기는 { name, detect, listScreens }를 내보내고 여기에 추가한다.
import * as nextjs from './nextjs.mjs';

export const DETECTORS = [nextjs];

export function detectorByName(name) {
  return DETECTORS.find((d) => d.name === name);
}
