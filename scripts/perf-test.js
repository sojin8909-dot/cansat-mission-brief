// AI 분석 엔드포인트(/api/analyze) 응답 속도/안정성 테스트.
// 사용법: node scripts/perf-test.js <배포 URL>
// 예:     node scripts/perf-test.js https://cansat-mission-brief.vercel.app

const fs = require('fs');
const path = require('path');

const baseUrl = (process.argv[2] || '').replace(/\/+$/, '');
if (!baseUrl){
  console.error('사용법: node scripts/perf-test.js <배포 URL>');
  process.exit(1);
}

const dummyIdeas = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dummy-ideas.json'), 'utf8')
);

function requiredFieldsPresent(body){
  return !!(
    body &&
    body.polished &&
    typeof body.polished.step1 !== 'undefined' &&
    body.feasibility &&
    body.risk_level &&
    Array.isArray(body.risks) &&
    Array.isArray(body.suggestions)
  );
}

async function runOne(idea){
  const start = Date.now();
  try {
    const res = await fetch(baseUrl + '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idea)
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(function(){ return null; });
    return {
      label: idea.label,
      ok: res.status === 200 && requiredFieldsPresent(body),
      status: res.status,
      elapsedMs: elapsed,
      body: body
    };
  } catch (err) {
    return {
      label: idea.label,
      ok: false,
      status: 0,
      elapsedMs: Date.now() - start,
      error: String(err)
    };
  }
}

(async function main(){
  console.log('대상: ' + baseUrl + '/api/analyze');
  console.log('더미 아이디어 ' + dummyIdeas.length + '건, 순차 호출 시작\n');

  var results = [];
  for (var i = 0; i < dummyIdeas.length; i++){
    var idea = dummyIdeas[i];
    process.stdout.write('[' + (i + 1) + '/' + dummyIdeas.length + '] ' + idea.label + ' ... ');
    var r = await runOne(idea);
    results.push(r);
    if (i < dummyIdeas.length - 1){
      await new Promise(function(resolve){ setTimeout(resolve, 4000); });
    }
    if (r.ok){
      console.log('성공 (' + r.elapsedMs + 'ms, feasibility=' + r.body.feasibility + ', risk=' + r.body.risk_level + ')');
    } else if (r.status === 0){
      console.log('실패 (네트워크 오류: ' + r.error + ')');
    } else {
      console.log('실패 (HTTP ' + r.status + ', ' + r.elapsedMs + 'ms) ' + JSON.stringify(r.body));
    }
  }

  var ok = results.filter(function(r){ return r.ok; });
  var times = ok.map(function(r){ return r.elapsedMs; });
  var avg = times.length ? Math.round(times.reduce(function(a,b){ return a+b; }, 0) / times.length) : 0;
  var min = times.length ? Math.min.apply(null, times) : 0;
  var max = times.length ? Math.max.apply(null, times) : 0;

  console.log('\n--- 요약 ---');
  console.log('성공: ' + ok.length + ' / ' + results.length);
  if (times.length){
    console.log('응답 시간: 평균 ' + avg + 'ms, 최소 ' + min + 'ms, 최대 ' + max + 'ms');
  }
  var failed = results.filter(function(r){ return !r.ok; });
  if (failed.length){
    console.log('실패 항목: ' + failed.map(function(r){ return r.label; }).join(', '));
  }
})();
