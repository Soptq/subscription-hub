import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {Context} from "../../Context";
import {useSnackbar} from "baseui/snackbar";

import {Tag, VARIANT} from 'baseui/tag';
const variants = Object.keys(VARIANT);

function ServiceUnclaimed() {
    const [serviceHash, setServiceHash] = useState("");
    const [count, setCount] = useState("0");
    const [loading, setLoading] = useState(false);

    const { context } = useContext(Context);
    const { enqueue } = useSnackbar();

    const getDecimal = async (tokenAddress) => {
        const contract = new ethers.Contract(
            tokenAddress,
            [
                "function decimals() view returns (uint256)"
            ],
            context.provider
        );
        try {
            return await contract.decimals();
        } catch (e) {
            return 18;
        }
    }

    const getServiceUnclaimed = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [, , tokenAddress, , ] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            const count = await context.contract.getServiceUnclaimedTokenAmount(serviceHash);
            const formattedCount = ethers.utils.formatUnits(count, await getDecimal(tokenAddress));
            setCount(formattedCount);
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
            <Heading>Check Unclaimed Tokens</Heading>
            <ParagraphSmall>Here you can check how many tokens you can claim. These tokens are from your subscribers.</ParagraphSmall>
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
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <ParagraphSmall><Tag closeable={false} variant={variants[1]} kind="positive">
                Unclaimed
            </Tag><strong>{count}</strong></ParagraphSmall>
        </HeadingLevel>
    )
}

export default ServiceUnclaimed;