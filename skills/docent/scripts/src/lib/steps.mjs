// 시나리오 단계 실행기. 요소는 셀렉터가 아니라 라벨·role로 찾는다. (설계 문서 9장)

const VAR = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

class StepError extends Error {}

// 값의 ${NAME}을 환경변수로 바꾼다. 없으면 이름만 담은 오류(값은 담지 않음)
function substitute(value, env) {
  return value.replace(VAR, (_, name) => {
    if (env[name] === undefined) throw new StepError(`환경변수 없음: ${name}`);
    return env[name];
  });
}

async function single(locator, describe, timeoutMs) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: timeoutMs });
  } catch {
    throw new StepError(`${describe}을(를) 찾을 수 없습니다`);
  }
  const count = await locator.count();
  if (count !== 1) throw new StepError(`${describe}이(가) ${count}개 있습니다. nth로 몇 번째인지 지정하세요`);
  return locator;
}

// 라벨로 입력 요소 찾기. <label>이 select를 감싸면 옵션 문구까지 라벨 이름에 섞이므로,
// 정확히 맞는 것이 없으면 label 요소의 '자기 글자'(감싼 컨트롤 제외)가 같은 것의 컨트롤을 찾는다.
let markSeq = 0;
async function byLabel(page, label, timeoutMs) {
  const exact = page.getByLabel(label, { exact: true });
  try {
    await exact.first().waitFor({ state: 'attached', timeout: Math.min(timeoutMs, 1500) });
    return exact;
  } catch {
    // 아래에서 다시 찾는다
  }
  const mark = `m${++markSeq}`;
  await page.evaluate(
    ({ label, mark }) => {
      for (const el of document.querySelectorAll('label')) {
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !n.matches('input,select,textarea,button')))
          .map((n) => n.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (own === label && el.control) el.control.setAttribute('data-docent-label', mark);
      }
    },
    { label, mark },
  );
  return page.locator(`[data-docent-label="${mark}"]`);
}

async function runStep(page, step, env, timeoutMs) {
  switch (step.do) {
    case 'fill': {
      const value = substitute(step.value, env);
      const el = await single(await byLabel(page, step.label, timeoutMs), `입력 항목 "${step.label}"`, timeoutMs);
      return el.fill(value, { timeout: timeoutMs });
    }
    case 'select': {
      const value = substitute(step.value, env);
      const el = await single(await byLabel(page, step.label, timeoutMs), `선택 항목 "${step.label}"`, timeoutMs);
      return el.selectOption({ label: value }, { timeout: timeoutMs });
    }
    case 'check': {
      const el = await single(await byLabel(page, step.label, timeoutMs), `체크 항목 "${step.label}"`, timeoutMs);
      return el.check({ timeout: timeoutMs });
    }
    case 'click': {
      const all = page.getByRole(step.role, { name: step.label, exact: true });
      const describe = `${step.role} "${step.label}"`;
      if (step.nth !== undefined) {
        const el = all.nth(step.nth);
        try {
          await el.waitFor({ state: 'visible', timeout: timeoutMs });
        } catch {
          throw new StepError(`${describe}의 ${step.nth}번째 요소를 찾을 수 없습니다`);
        }
        return el.click({ timeout: timeoutMs });
      }
      return (await single(all, describe, timeoutMs)).click({ timeout: timeoutMs });
    }
    case 'expectText':
      try {
        await page.getByText(step.text, { exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });
      } catch {
        throw new StepError(`문구 "${step.text}"가 나타나지 않았습니다`);
      }
      return undefined;
    case 'wait':
      return page.waitForTimeout(step.ms);
    case 'goto':
      return page.goto(new URL(step.path, page.url()).href, { timeout: timeoutMs * 3 });
    default:
      throw new StepError(`알 수 없는 단계: ${step.do}`);
  }
}

export async function runSteps(page, steps, { env = process.env, timeoutMs = 5000, onStep } = {}) {
  for (let index = 0; index < steps.length; index++) {
    try {
      await runStep(page, steps[index], env, timeoutMs);
    } catch (err) {
      // Playwright 오류 메시지에는 입력값이 들어갈 수 있으므로 우리 메시지만 쓴다
      const reason = err instanceof StepError ? err.message : `${steps[index].do} 단계 실행 실패`;
      return { ok: false, index, reason };
    }
    if (onStep) await onStep(index);
  }
  return { ok: true };
}

export async function applyMask(page, selectors) {
  if (!selectors?.length) return;
  await page.addStyleTag({ content: `${selectors.join(', ')} { filter: blur(6px) !important; }` });
}
