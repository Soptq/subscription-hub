import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import React, {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";
import {StatefulDataTable, StringColumn} from "baseui/data-table";
import {useStyletron} from "baseui";

function UserGetConfig() {
    const [serviceHash, setServiceHash] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [css] = useStyletron();
    const { context} = useContext(Context);
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

    const getServiceConfig = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [proposer, receiver, tokenAddress, amount, version] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            const formattedAmount = ethers.utils.formatUnits(amount, await getDecimal(tokenAddress));
            setData([{
                id: 0,
                data: [proposer, receiver, tokenAddress, formattedAmount, version.toString()],
            }]);
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

    const columns = [
        StringColumn({
            title: 'Proposer',
            mapDataToValue: (data) => data[0],
        }),
        StringColumn({
            title: 'Receiver',
            mapDataToValue: (data) => data[1],
        }),
        StringColumn({
            title: 'Token Address',
            mapDataToValue: (data) => data[2],
        }),
        StringColumn({
            title: 'Token Amount',
            mapDataToValue: (data) => data[3],
        }),
        StringColumn({
            title: 'Service ID',
            mapDataToValue: (data) => data[4],
        }),
    ];

    return (
        <HeadingLevel>
            <Heading>Get Service Configuration</Heading>
            <ParagraphSmall>Here you can check the specification of a live service</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getServiceConfig}>
                Check
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            {data.length > 0 && <div className={css({height: '145px'})}>
                <StatefulDataTable columns={columns} rows={data} emptyMessage="No Data"/>
            </div>}
        </HeadingLevel>
    )
}

export default UserGetConfig;