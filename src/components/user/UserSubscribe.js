import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";
import {
    Checkbox,
    LABEL_PLACEMENT
} from "baseui/checkbox";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";

function UserSubscribe() {
    const [serviceHash, setServiceHash] = useState('');
    const [renewal, setRenewal] = useState(true);

    const [loading, setLoading] = useState(false);

    const { context} = useContext(Context);
    const { enqueue } = useSnackbar();

    const setAllowance = async (tokenAddress, spender, amount) => {
        const tokenToApprove = new ethers.Contract(
            tokenAddress,
            [
                "function approve(address spender, uint amount) public returns(bool)",
                "function allowance(address owner, address spender) external view returns (uint)"
            ],
            await context.provider.getSigner(context.walletAddress),
        );
        const allowance = await tokenToApprove.allowance(context.walletAddress, spender);
        if (allowance.gte(amount)) {
            return;
        }
        const estimatedGasLimit = await tokenToApprove.estimateGas.approve(spender, amount);
        const estimatedGasPrice = await context.provider.getGasPrice();
        const tx = await tokenToApprove.approve(spender, amount, {
            gasLimit: estimatedGasLimit.mul(2),
            gasPrice: estimatedGasPrice
        });
        await tx.wait();
    };

    const approveToken = async (tokenAddress, amount) => {
        // set unlimited allowance
        if (renewal) {
            await setAllowance(tokenAddress, context.contract.address, ethers.constants.MaxUint256);
        } else {
            await setAllowance(tokenAddress, context.contract.address, amount);
        }
    }

    const subscribeService = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [, , tokenAddress, amount, version] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            // approve token
            await approveToken(tokenAddress, amount);
            // make a signature
            let messageHash = ethers.utils.solidityKeccak256(
                ["address", "bytes32", "uint256"],
                [context.walletAddress, serviceHash, version],
            );

            let messageHashBinary = ethers.utils.arrayify(messageHash);
            const signature = await (await context.provider.getSigner(context.walletAddress)).signMessage(messageHashBinary);
            // make subscription
            const estimatedGasLimit = await context.contract.estimateGas.subscribeService(
                serviceHash,
                renewal,
                signature,
            );
            const estimatedGasPrice = await context.provider.getGasPrice();
            const subscriberHashTx = await context.contract.subscribeService(
                serviceHash, renewal, signature, {
                    gasLimit: estimatedGasLimit.mul(2),
                    gasPrice: estimatedGasPrice
                }
            );
            await subscriberHashTx.wait();
            enqueue({
                message: 'Subscribe successfully!',
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
            <Heading>Subscribe a Service</Heading>
            <ParagraphSmall>Here by providing the following parameters, you can subscribe the respective service.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Checkbox
                checked={renewal}
                onChange={e => setRenewal(e.currentTarget.checked)}
                labelPlacement={LABEL_PLACEMENT.right}
            >
                Automatically Renew the Subscription
            </Checkbox>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <ParagraphSmall>
                By pressing subscribe button, you will need to first approve the contract to spend your token, and then you will make a signature to prove your identity, and finally you will be able to subscribe the service.
            </ParagraphSmall>
            <Button size="compact" isLoading={loading} onClick={subscribeService}>
                Subscribe
            </Button>
        </HeadingLevel>
    )
}

export default UserSubscribe;