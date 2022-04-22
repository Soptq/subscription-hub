import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";

function UserUnsubscribe() {
    const [serviceHash, setServiceHash] = useState('');

    const [loading, setLoading] = useState(false);

    const { context} = useContext(Context);
    const { enqueue } = useSnackbar();

    const unsubscribeService = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [, , , , version] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            // make a signature
            let messageHash = ethers.utils.solidityKeccak256(
                ["address", "bytes32", "uint256"],
                [context.walletAddress, serviceHash, version],
            );

            let messageHashBinary = ethers.utils.arrayify(messageHash);
            const signature = await (await context.provider.getSigner(context.walletAddress)).signMessage(messageHashBinary);
            // make subscription
            const estimatedGasLimit = await context.contract.estimateGas.unsubscribeService(
                serviceHash,
                signature,
            );
            const estimatedGasPrice = await context.provider.getGasPrice();
            const unsubscriberHashTx = await context.contract.unsubscribeService(
                serviceHash, signature, {
                    gasLimit: estimatedGasLimit.mul(2),
                    gasPrice: estimatedGasPrice
                }
            );
            await unsubscriberHashTx.wait();
            enqueue({
                message: 'Unsubscribe successfully!',
            })
            setLoading(false);
        } catch (e) {
            console.log(e);
            enqueue({
                message: "Failed to fetch: " + e.toString(),
                kind: "error",
            });
            setLoading(false);
        }
    }

    return (
        <HeadingLevel>
            <Heading>Unsubscribe a Service</Heading>
            <ParagraphSmall>Here you can unsubscribe a service. Note that after unsubscribing, your current subscription plan will still be valid unless the period is end (i.e. after your next payment block).</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={unsubscribeService}>
                Unsubscribe
            </Button>
        </HeadingLevel>
    )
}

export default UserUnsubscribe;