import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState} from "react";
import {Button} from "baseui/button";

import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";

function ServiceUnregister() {
    const [serviceHash, setServiceHash] = useState('');
    const [loading, setLoading] = useState(false);

    const { context} = useContext(Context);
    const { enqueue } = useSnackbar();

    const unregisterService = async () => {
        setLoading(true);
        try {
            const estimatedGasLimit = await context.contract.estimateGas.unregisterService(serviceHash);
            const estimatedGasPrice = await context.provider.getGasPrice();

            const unregisterTx = await context.contract.unregisterService(
                serviceHash,
                {
                    gasLimit: estimatedGasLimit.mul(2),
                    gasPrice: estimatedGasPrice,
                }
            );
            await unregisterTx.wait();
            enqueue({
                message: 'Service unregistered successfully'
            });
            setLoading(false);
        } catch (e) {
            console.log(e);
            enqueue({
                message: "Failed to register the service: " + e.toString(),
                kind: "error",
            });
            setLoading(false);
        }
    }

    return (
        <HeadingLevel>
            <Heading>Unregister Your Service</Heading>
            <ParagraphSmall>Here you can unregister your service, all subscribers will be unsubscribed automatically. However, their subscription will be valid until the end of their current subscription period.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={unregisterService}>
                Unregister Service
            </Button>
        </HeadingLevel>
    )
}

export default ServiceUnregister;