import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {Context} from "../../Context";
import {useSnackbar} from "baseui/snackbar";

function ServiceClaim() {
    const [serviceHash, setServiceHash] = useState("");
    const [loading, setLoading] = useState(false);

    const { context } = useContext(Context);
    const { enqueue } = useSnackbar();

    const getServiceUnclaimed = async () => {
        setLoading(true);
        try {
            const count = await context.contract.getServiceUnclaimedTokenAmount(serviceHash);
            if (count.gt(0)) {
                const estimatedGasLimit = await context.contract.estimateGas.claimToken(serviceHash);
                const estimatedGasPrice = await context.provider.getGasPrice();
                const claimTx = await context.contract.claimToken(serviceHash, {
                    gasLimit: estimatedGasLimit.mul(2),
                    gasPrice: estimatedGasPrice,
                });
                await claimTx.wait();
                enqueue({
                    message: "Token claimed successfully"
                });
            } else {
                throw new Error("No unclaimed tokens");
            }
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
            <Heading>Claim Tokens</Heading>
            <ParagraphSmall>Here you can claim your unclaimed tokens if there are some.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getServiceUnclaimed}>
                Check
            </Button>
        </HeadingLevel>
    )
}

export default ServiceClaim;