import { TonClient, WalletContractV4, internal, TonClient4, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from 'ton-crypto';
import { getHttpV4Endpoint } from '@orbs-network/ton-access';
import * as dotenv from 'dotenv';
dotenv.config();

if (!WalletContractV4) {
    throw new Error("WalletContractV4 is not available. Check your imports.");
}

const transfer = async (dest: any, wager: any) => {
    const endpoint = await getHttpV4Endpoint({ network: 'testnet' });
    const client = new TonClient4({ endpoint });//,apiKey:"a69840dc49e6cd344adb3d936395e0004be71d05e6f56315215ca3e80e38dc4e"}
    let mnemonics = (process.env.mnemonics || '').toString();
    let keyPair = await mnemonicToPrivateKey(mnemonics.split(' '));

    let workchain = 0;
    let wallet_create = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
    });
    let wallet = client.open(wallet_create);
    console.log('Wallet address: ', wallet.address);
    console.log("pub key:", keyPair.publicKey)
    console.log("sec key:", keyPair.secretKey)

    let seqno = await wallet.getSeqno();
    let balance = await wallet.getBalance();
    console.log(balance);
    await wallet.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: Address.parse(dest),
                value: wager,
            }),
        ],

    });

    console.log("transfered");
    console.log("to: ", dest);
    console.log("reward:", wager);
}

export default transfer;