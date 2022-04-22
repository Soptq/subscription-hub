import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";

import {Tag, VARIANT} from 'baseui/tag';
const variants = Object.keys(VARIANT);

function UserGetNextPaymentBlock() {
    const [serviceHash, setServiceHash] = useState('');
    const [nextPaymentBlock, setNextPaymentBlock] = useState('0');

    const [loading, setLoading] = useState(false);

    const { context} = useContext(Context);
    const { enqueue } = useSnackbar();

    const getNextPaymentBlock = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [, , , , version] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            const checkedAddress = ethers.utils.getAddress(context.walletAddress);
            const subscribed = await context.contract.checkSubscribed(checkedAddress, serviceHash, version);
            if (!subscribed) {
                throw new Error('User is not subscribed to this service');
            }
            const nextPaymentBlock = await context.contract.getNextPaymentBlock(checkedAddress, serviceHash);
            setNextPaymentBlock(nextPaymentBlock);
            setLoading(false);
        } catch (e) {
            setNextPaymentBlock("0");
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
            <Heading>Next Payment</Heading>
            <ParagraphSmall>Here you can get the next block number of your payment for the subscription.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getNextPaymentBlock}>
                Check
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <ParagraphSmall>
                <Tag closeable={false} variant={variants[1]} kind="positive">
                    Next Payment
                </Tag><strong>{nextPaymentBlock.toString()}</strong>
            </ParagraphSmall>
        </HeadingLevel>
    )
}

export default UserGetNextPaymentBlock;