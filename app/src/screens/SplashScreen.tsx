import { useState, useRef } from 'react';
import { useApp, landingScreenForRole } from '@/context/AppContext';
import { Check, ShieldAlert } from 'lucide-react';

export default function SplashScreen() {
  const { state, dispatch } = useApp();
  const [agreed, setAgreed] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [canConfirmRead, setCanConfirmRead] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleStart = () => {
    if (!agreed) return;
    dispatch({
      type: 'NAVIGATE',
      screen: state.user ? landingScreenForRole(state.user.role) : 'login',
    });
  };

  const openDisclaimer = () => {
    setShowDisclaimer(true);
    setCanConfirmRead(false);
  };

  const closeDisclaimer = () => {
    if (!canConfirmRead) return;
    setShowDisclaimer(false);
    setHasRead(true);
    setAgreed(true);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current || canConfirmRead) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // 滚动到距离底部100px内时，启用确认按钮
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setCanConfirmRead(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-orange-50 to-amber-50 px-6 relative">
      {/* Logo */}
      <div className="mb-6">
        <img 
          src="/images/logo.png" 
          alt="药邻 Logo" 
          className="w-32 h-32 object-contain drop-shadow-lg"
        />
      </div>
      
      {/* App Name */}
      <h1 className="text-3xl font-bold text-gray-800 mb-2">药邻</h1>
      
      {/* Slogan */}
      <p className="text-sm text-gray-500 mb-8">让药品在邻里间流动</p>
      
      {/* Feature Highlights */}
      <div className="w-full space-y-3 mb-8">
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M3 7h18"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/><path d="M12 12v.01"/></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">AI 识药</p>
            <p className="text-xs text-gray-500">拍照识别，自动录入</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">过期提醒</p>
            <p className="text-xs text-gray-500">智能预警，减少浪费</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur rounded-xl p-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">社区互助</p>
            <p className="text-xs text-gray-500">邻里共享，互帮互助</p>
          </div>
        </div>
      </div>

      {/* Disclaimer Checkbox - must read full disclaimer first */}
      <div className="w-full max-w-xs mb-4">
        <div className="flex items-start gap-3 w-full">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
            agreed ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
          }`}>
            {agreed && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          {hasRead ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              我已阅读并同意
              <span className="text-orange-500 underline">《药品邻里共享服务免责声明》</span>
              ，知晓私人间流转药品存在法律风险与健康风险，自愿承担使用本平台的全部责任。
            </p>
          ) : (
            <p className="text-xs text-gray-500 leading-relaxed">
              请先阅读
              <span 
                onClick={openDisclaimer}
                className="text-orange-500 underline cursor-pointer font-medium"
              >
                《免费共享药品服务免责声明》
              </span>
              ，本平台所有药品共享均为免费赠送，严禁任何形式的有偿交易。
            </p>
          )}
        </div>
      </div>
      
      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={!agreed}
        className={`w-full max-w-xs font-semibold py-4 rounded-full shadow-lg transition-all ${
          agreed
            ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-orange-200 active:scale-[0.97]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {agreed ? '开始体验' : '请先阅读免责声明'}
      </button>

      {/* Bottom hint */}
      <p className="text-[10px] text-gray-400 mt-3 text-center max-w-xs leading-relaxed">
        温馨提示：本平台所有药品共享均为免费赠送，禁止药品售卖；私转处方药、有偿售药均涉嫌违法，自行用药存在健康风险。
      </p>

      {/* Full Disclaimer Modal - CANNOT be closed without scrolling to bottom */}
      {showDisclaimer && (
        <div className="absolute inset-0 z-50 flex items-end">
          {/* Backdrop - no onClick, cannot close by clicking outside */}
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full bg-white rounded-t-3xl p-6 animate-slideUp max-h-[85%] flex flex-col">
            {/* Header - no close button, must scroll to bottom */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">药品邻里共享服务免责声明</h2>
            </div>
            
            {/* Scrollable Content */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto pr-1"
            >
              <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
                
                {/* Section 1 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">一、平台定位与服务性质</h3>
                  <p>1.1 「药邻」APP（以下简称"本平台"）仅作为<strong>邻里间闲置药品信息互助的线上展示渠道</strong>，提供药品信息共享、过期提醒、社区互助等信息服务功能。</p>
                  <p className="mt-1.5">1.2 本平台<strong>不具备</strong>《药品经营许可证》、<strong>不具备</strong>医疗机构执业许可资质，不从事任何形式的药品经营、销售、配送活动，不参与任何药品的实际交易或资金往来。</p>
                  <p className="mt-1.5">1.3 本平台所有药品共享行为均为<strong>用户间自发的无偿互助行为</strong>，平台仅提供信息撮合服务，不对任何药品共享行为承担中介、担保或背书责任。</p>
                </div>

                {/* Section 2 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">二、严禁有偿药品交易</h3>
                  <p>2.1 本平台<strong>严禁任何形式的药品有偿买卖、加价转让、以物易物等变相交易行为</strong>。用户利用本平台从事药品销售活动的，由行为人自行承担全部行政、民事及刑事责任。</p>
                  <p className="mt-1.5">2.2 用户私下进行有偿药品交换、资金转账的，与本平台无关。一经发现或被举报，平台有权立即下架相关信息、限制账号功能，并保留向市场监管部门举报的权利。</p>
                  <p className="mt-1.5">2.3 依据《中华人民共和国药品管理法》第五十一条规定，从事药品批发、零售活动应当取得药品经营许可证。个人无证经营药品的，由药品监督管理部门没收违法所得，并处货值金额十五倍以上三十倍以下罚款。</p>
                </div>

                {/* Section 3 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">三、允许共享的药品范围</h3>
                  <p>3.1 本平台<strong>仅支持共享乙类非处方药（绿OTC）</strong>，且须同时满足以下条件：</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>药品在有效期内，且剩余有效期不少于3个月；</li>
                    <li>药品包装完整、标签清晰、储存条件合规；</li>
                    <li>药品来源合法（正规药店、医院购得）；</li>
                    <li>药品外观无变色、无异味、无受潮变质迹象。</li>
                  </ul>
                  <p className="mt-1.5">3.2 <strong>以下药品严禁在本平台发布、流转：</strong></p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>处方药（Rx）、甲类非处方药（红OTC）；</li>
                    <li>麻醉药品、精神药品、医疗用毒性药品、放射性药品；</li>
                    <li>含麻黄碱类、含可待因复方口服液体制剂等特殊管理药品；</li>
                    <li>过期药品、变质药品、包装破损药品；</li>
                    <li>来源不明、无批准文号、无生产企业的药品；</li>
                    <li>自制中药制剂、偏方、保健品冒充药品；</li>
                    <li>疫苗、血液制品、生物制品等特殊药品。</li>
                  </ul>
                  <p className="mt-1.5">3.3 用户违规发布上述禁限药品的，由发布人独立承担全部法律责任，包括但不限于行政处罚、人身损害赔偿、刑事责任。</p>
                </div>

                {/* Section 4 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">四、用药风险提示</h3>
                  <p>4.1 药品具有严格的个体适配性，不同人群因年龄、体质、过敏史、基础疾病、用药史等差异，对同一种药品的反应可能截然不同。<strong>邻里间共享药品仅为临时应急之用，不能替代正规医疗机构的诊断和治疗。</strong></p>
                  <p className="mt-1.5">4.2 领取共享药品的用户（以下简称"领取人"）在使用药品前，应当：</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>仔细阅读药品说明书，了解适应症、禁忌症、用法用量、不良反应；</li>
                    <li>确认自身无该药品的过敏史或禁忌症；</li>
                    <li>如对用药有任何疑问，应先咨询执业医师或执业药师；</li>
                    <li>用药后出现不适，应立即停药并就医。</li>
                  </ul>
                  <p className="mt-1.5">4.3 <strong>因自行用药导致的任何身体损伤、健康损失、病情加重、过敏反应、药物中毒、延误治疗等后果，由领取人自行承担全部责任，平台不承担任何赔偿责任。</strong></p>
                </div>

                {/* Section 5 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">五、药品发布人责任</h3>
                  <p>5.1 发布共享药品的用户（以下简称"发布人"）对其发布的药品信息真实性、合法性、安全性承担完全责任。</p>
                  <p className="mt-1.5">5.2 发布人有义务确保所发布药品满足以下条件：</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>药品在有效期内且储存条件合规；</li>
                    <li>药品包装完好、标签清晰可辨；</li>
                    <li>药品未变质、未受污染；</li>
                    <li>所发布的药品信息（名称、规格、适应症、有效期等）真实准确。</li>
                  </ul>
                  <p className="mt-1.5">5.3 <strong>因药品过期、变质、错发、信息不实等原因造成他人损害的，由发布人独立承担全部民事赔偿责任；涉嫌犯罪的，依法追究刑事责任。</strong></p>
                </div>

                {/* Section 6 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">六、平台责任限制</h3>
                  <p>6.1 本平台仅提供信息技术服务，不对用户发布的任何药品信息的真实性、合法性、安全性进行实质性审查，亦不对药品的质量、疗效、安全性做任何明示或默示的担保。</p>
                  <p className="mt-1.5">6.2 本平台不提供用药指导、医疗诊断、健康咨询等医疗服务，用户在平台上获取的任何药品相关信息均不构成医疗建议。</p>
                  <p className="mt-1.5">6.3 对于因网络延迟、系统故障、第三方攻击等技术原因导致的信息丢失、错误展示或服务中断，平台将尽力修复但不承担由此产生的直接或间接损失。</p>
                  <p className="mt-1.5">6.4 用户通过本平台获取的药品仅用于自用，不得二次转售或转赠他人。</p>
                </div>

                {/* Section 7 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">七、用户承诺与权利放弃</h3>
                  <p>7.1 用户注册使用本平台即表示：</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>已年满18周岁，具有完全民事行为能力；</li>
                    <li>已充分阅读、理解并同意本免责声明的全部内容；</li>
                    <li>已充分知晓私人间流转药品存在的法律风险与健康风险；</li>
                    <li>自愿承担使用本平台服务的全部风险与后果。</li>
                  </ul>
                  <p className="mt-1.5">7.2 <strong>用户承诺放弃因用药问题、药品质量问题或共享纠纷向平台及其运营方、关联方主张索赔、追偿、诉讼的权利。</strong>用户之间的药品共享纠纷，由双方自行协商解决或通过司法途径处理。</p>
                  <p className="mt-1.5">7.3 用户违反本声明或平台规则的，平台有权不经通知直接采取以下措施：删除违规信息、限制账号功能、永久封禁账号，并配合市场监管部门、公安机关的调查取证。</p>
                </div>

                {/* Section 8 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">八、监管配合与举报机制</h3>
                  <p>8.1 平台设有违规信息举报入口，任何用户发现违规售药、发布处方药、发布过期药品等行为，均可一键举报。</p>
                  <p className="mt-1.5">8.2 平台将积极配合药品监督管理部门、卫生健康部门、公安机关的监督检查和调查取证工作，依法提供必要的技术支持和数据协助。</p>
                </div>

                {/* Section 9 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">九、免责声明的更新与生效</h3>
                  <p>9.1 本平台有权根据法律法规的变化及运营需要，不时修改本免责声明。修改后的声明将在平台显著位置公布，用户继续使用平台服务视为接受修改后的声明。</p>
                  <p className="mt-1.5">9.2 本免责声明自用户勾选同意之时起生效，对用户具有法律约束力。如用户不同意本声明的任何条款，应立即停止使用本平台服务。</p>
                  <p className="mt-1.5">9.3 本免责声明的解释权及修订权归本平台运营方所有。本声明未尽事宜，依照中华人民共和国相关法律法规执行。</p>
                </div>

                {/* Last */}
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-xs text-orange-700 leading-relaxed">
                    <strong>特别提示：</strong>药品是特殊商品，直接关系人身健康和生命安全。邻里药品互助虽出于善意，但仍存在不可控风险。本平台强烈建议：身体不适请优先前往正规医疗机构就诊，用药前务必咨询专业医师或药师。
                  </p>
                </div>

                <p className="text-xs text-gray-400 text-center pb-4">
                  最后更新日期：2026年7月16日
                </p>
              </div>
            </div>
            
            {/* Bottom Button - only enabled after scrolling to bottom */}
            <div className="shrink-0 pt-4 border-t border-gray-100 mt-4">
              {!canConfirmRead && (
                <p className="text-xs text-gray-400 text-center mb-2">请向下滚动阅读完整条款</p>
              )}
              <button
                onClick={closeDisclaimer}
                disabled={!canConfirmRead}
                className={`w-full h-12 rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98] ${
                  canConfirmRead
                    ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-orange-200'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canConfirmRead ? '我已阅读完毕' : '请继续阅读'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
