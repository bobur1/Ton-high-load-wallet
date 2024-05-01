import { Wallet } from './wrapper/wallet';
import { TonClient, TonClient4,  WalletContractV4 } from "ton";
import TonWeb from "tonweb";
import dotenv from 'dotenv';
import { mnemonicToWalletKey } from "ton-crypto";
import fs from 'fs/promises'; // Using fs/promises for asynchronous file operations
import {
    Address,
    beginCell,
    Cell,
    StateInit
} from 'ton-core';

type MessageToSend = {
    recipient: Address;
    value: bigint;
    init?: StateInit;
    body?: Cell;
};

dotenv.config();
const BN = TonWeb.utils.BN;

async function main() {
    // our TON API key
    const TON_TESTNET_API_KEY = process.env.TON_TESTNET_API_KEY;
    const TON_MAINNET_API_KEY = process.env.TON_MAINNET_API_KEY;
    // our jetton address
    const JETTON_ADDRESS = process.env.JETTON_ADDRESS;
    if(!JETTON_ADDRESS) {
        throw new Error("Please provide JETTON_ADDRESS in .env file");
    }
    // mnemonic for HOT wallet
    // v4R2
    const mnemonic = process.env.MNEMONIC;
    if(!mnemonic) {
        throw new Error("Please provide MNEMONIC in .env file");
    }
    const isMainnet = process.env.IS_MAINNET === 'true';

    // get the decentralized RPC endpoint  
    const endpoint = isMainnet ? 'https://toncenter.com/api/v2/jsonRPC': 'https://testnet.toncenter.com/api/v2/jsonRPC';
    let client = new TonClient({
        endpoint: endpoint,
        apiKey: isMainnet ? TON_MAINNET_API_KEY : TON_TESTNET_API_KEY
    });
    // mnemonic for HOT wallet
    // v4R2
    const startId = parseInt(process.env.WINNERS_START_ID || '1'); // Change this to the desired starting ID (zero-based index)

    // Use toncenter.com as HTTP API endpoint to interact with TON blockchain.
    // You can get HTTP API key at https://t.me/tonapibot
    // You can run your own HTTP API instance https://github.com/toncenter/ton-http-api
    const tonweb = isMainnet ?
        new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {apiKey: TON_MAINNET_API_KEY})) :
        new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC', {apiKey: TON_TESTNET_API_KEY}));
    // const tonweb = new TonWeb(new TonWeb.HttpProvider(endpointUrl, {apiKey: process.env.API_KEY}));

    const keyPair = await mnemonicToWalletKey(mnemonic.split(" "));

    const WalletClass = tonweb.wallet.all.v4R2;

    const deployWallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
        wc: 0
    });

    const wallet = client.open(Wallet.createFromPublicKey(keyPair.publicKey, 0));
    console.log('Wallet address: ', wallet.address.toString());

    // const tonClient = new TonClient4({
    //     endpoint: "https://testnet-v4.tonhubapi.com",
    //   });
    // const senderWallet = tonClient.open(
    //     WalletContractV4.create({
    //       workchain: 0,
    //       publicKey: keyPair.publicKey,
    //     }),
    //   );
    // const sender = senderWallet.sender(keyPair.secretKey);
    // const deployResult = await wallet.sendDeploy(
    //     sender,
    //     TonWeb.utils.toNano('0.05')
    // );

    // console.log('Deploy result: ', deployResult);

    // // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // // @ts-ignore
    // const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
    //     address: JETTON_ADDRESS
    // });

    // // sender jetton wallet address
    // const jettonWalletAddress = await jettonMinter.getJettonWalletAddress(
    //     new TonWeb.utils.Address("EQD9UmPnqGxgrH98wiolCvrZ1EqKtK6VgdtJIEU62UZcwGUs")
    // );

    // sender jetton wallet
    const jettonWallet =  new TonWeb.token.jetton.JettonWallet(tonweb.provider, {
        address: "EQD9UmPnqGxgrH98wiolCvrZ1EqKtK6VgdtJIEU62UZcwGUs"
    });
    
    const jettonBalance = (await jettonWallet.getData()).balance;

    console.log('Jetton balance: ', jettonBalance.toString());
    
    const winnersData = await fs.readFile('winners.json', 'utf-8');
    const winners = JSON.parse(winnersData);
    let messages: MessageToSend[] = [];
    let total = 0;
    const forwardPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail('test air drop')
        .endCell();
    for (const recipient of winners) {
        const amount = recipient.amount;
        const toWallet = Address.parse(recipient.wallet)
        total += amount;
        console.log('Sending ', amount, ' to ', recipient.wallet);
        messages.push({
            // jetton_wallet_address
            recipient: Address.parse("EQD9UmPnqGxgrH98wiolCvrZ1EqKtK6VgdtJIEU62UZcwGUs"),
            value: TonWeb.utils.toNano('0.06'),
            body: beginCell()
                .storeUint(0x0f8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(amount)
                .storeAddress(toWallet)
                .storeAddress(wallet.address)
                .storeBit(false)
                .storeCoins(1n)
                .storeBit(false)
                .storeUint(0, 32)
                .storeStringTail('airdrop')
                .endCell()
        });
    }

    await wallet.sendTransfers(keyPair, messages);
}

main().then(()=>{
    console.log('succeed');
}).catch((err)=>{
    console.log('Error: ', err);
});