import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";
import {Tag, VARIANT} from 'baseui/tag';
const variants = Object.keys(VARIANT);

function ServiceSubscriptionsCount() {
    const [serviceHash, setServiceHash] = useState("");
    const [count, setCount] = useState("0");
    const [loading, setLoading] = useState(false);

    const { context } = useContext(Context);
    const { enqueue } = useSnackbar();

    const getServiceSubscriptionsCount = async () => {
        setLoading(true);
        try {
            const count = await context.contract.getServiceSubscriptionCount(serviceHash);
            setCount(count.toString());
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
            <Heading>Check Subscriptions Count</Heading>
            <ParagraphSmall>Here you can check how many people subscribing your service.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getServiceSubscriptionsCount}>
                Check
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>

            <ParagraphSmall>
                <Tag closeable={false} variant={variants[1]} kind="positive">
                    Count
                </Tag><strong>{count}</strong><strong>
            </strong></ParagraphSmall>
        </HeadingLevel>
    )
}

export default ServiceSubscriptionsCount;