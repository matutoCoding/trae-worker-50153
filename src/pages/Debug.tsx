import { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, Zap, Users, Wallet, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api, type ConcurrencyTestResult, type ConcurrencyTestCaseResult } from '@/lib/api';

export default function Debug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConcurrencyTestResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const runTests = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.runConcurrencyTests();
      setResult(data);
    } catch (e) {
      console.error('测试失败', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const getStatusIcon = (passed: boolean) =>
    passed ? (
      <CheckCircle className="w-5 h-5 text-emerald-500" />
    ) : (
      <XCircle className="w-5 h-5 text-rose-500" />
    );

  const getTestIcon = (name: string) => {
    if (name.includes('琴房')) return <Users className="w-5 h-5 text-amber-600" />;
    if (name.includes('额度')) return <Wallet className="w-5 h-5 text-emerald-600" />;
    if (name.includes('超时')) return <Clock className="w-5 h-5 text-sky-600" />;
    return <Zap className="w-5 h-5 text-gray-500" />;
  };

  const formatValue = (val: any, depth = 0): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? '是' : '否';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      if (depth > 1) return `[${val.length} 项]`;
      return val.map((v) => formatValue(v, depth + 1)).join('、');
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">并发验证</h1>
          <p className="text-gray-500 mt-1">一键测试多人抢琴房、额度并发扣减、锁超时等场景</p>
        </div>
        <button
          onClick={runTests}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-900 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              开始测试
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={`rounded-2xl p-5 border ${
          result.allPassed
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-center gap-4">
            {result.allPassed ? (
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            )}
            <div>
              <p className="text-lg font-bold text-gray-900">
                {result.allPassed ? '全部通过' : '部分测试未通过'}
              </p>
              <p className="text-sm text-gray-600">
                共 {result.total} 个用例，通过 {result.passed} 个，失败 {result.failed} 个
              </p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.results.map((test) => (
            <TestCaseCard
              key={test.name}
              test={test}
              expanded={!!expanded[test.name]}
              onToggle={() => toggleExpand(test.name)}
              icon={getTestIcon(test.name)}
            />
          ))}
        </div>
      )}

      {!result && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">点击上方「开始测试」按钮</p>
          <p className="text-sm text-gray-400">自动运行并发场景验证，完成后查看详细结果</p>
        </div>
      )}
    </div>
  );
}

interface TestCaseCardProps {
  test: ConcurrencyTestCaseResult;
  expanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}

function TestCaseCard({ test, expanded, onToggle, icon }: TestCaseCardProps) {
  const issueCount = test.details?.issues?.length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          test.passed ? 'bg-emerald-50' : 'bg-rose-50'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{test.name}</p>
            {test.passed ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                通过
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                失败
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{test.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!test.passed && issueCount > 0 && (
            <span className="text-xs text-rose-500 font-medium">
              {issueCount} 个问题
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          {test.error && (
            <div className="mb-4 p-3 bg-rose-50 rounded-lg text-sm text-rose-700">
              <p className="font-medium mb-1">错误信息</p>
              <p className="font-mono text-xs">{test.error}</p>
            </div>
          )}

          {test.details?.issues && test.details.issues.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">问题列表</p>
              <ul className="space-y-1">
                {test.details.issues.map((issue: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-700">
                    <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">详细数据</p>
            <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
              {Object.entries(test.details)
                .filter(([key]) => key !== 'issues')
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-500">{formatKey(key)}</span>
                    <span className="text-gray-900 font-mono text-xs">
                      {formatDetailValue(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatKey(key: string): string {
  const map: Record<string, string> = {
    roomId: '琴房ID',
    roomName: '琴房名称',
    startTime: '开始时间',
    endTime: '结束时间',
    testDate: '测试日期',
    originalBalance: '原始余额',
    balanceBeforeTest: '测试前余额',
    balanceAfterTest: '测试后余额',
    testAmountPerRequest: '每次扣减',
    concurrency: '并发数',
    targetTotal: '目标总额',
    expectedSuccessful: '预期成功数',
    expectedRemaining: '预期剩余',
    successfulDeductions: '成功扣减次数',
    failedDeductions: '失败次数',
    insufficientFailures: '额度不足失败',
    otherFailures: '其他失败',
    successCount: '成功数',
    failureCount: '失败数',
    conflictFailureCount: '冲突失败数',
    user1Result: '用户1结果',
    user2Result: '用户2结果',
    conflictInfo: '冲突信息',
    shortTimeoutMs: '超时时长',
    longHoldTimeMs: '持锁时长',
    timeoutResult: '超时结果',
    timeoutAfterMs: '实际超时时间',
  };
  return map[key] ?? key;
}

function formatDetailValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? '✅ 是' : '❌ 否';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (val.length > 60) return val.slice(0, 60) + '...';
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return `[${val.length} 项]`;
  }
  if (typeof val === 'object') {
    if (val.success !== undefined) {
      return val.success ? '✅ 成功' : `❌ ${val.error || '失败'}`;
    }
    if (val.firstConflict) {
      const c = val.firstConflict;
      return `${c.startTime?.slice(11, 16) || ''} 被 ${c.conflictUserName || '未知'}`;
    }
    return JSON.stringify(val);
  }
  return String(val);
}
