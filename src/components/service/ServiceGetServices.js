import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import React, {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";
import {StatefulDataTable, StringColumn} from "baseui/data-table";
import {useStyletron} from "baseui";

function ServiceGetServices() {
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

    const getServices = async () => {
        setLoading(true);
        try {
            const checkedAddress = ethers.utils.getAddress(context.walletAddress);
            const services = await context.contract.getServices(checkedAddress);
            const formattedData = []
            for (const serviceHash of services) {
                const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
                const [proposer, receiver, tokenAddress, amount, version] = ethers.utils.defaultAbiCoder.decode(
                    ["address", "address", "address", "uint256", "uint256"],
                    retrievedConfig,
                );
                const formattedAmount = ethers.utils.formatUnits(amount, await getDecimal(tokenAddress));
                formattedData.push({
                    data: [serviceHash, proposer, receiver, tokenAddress, formattedAmount, version.toString()]
                })
            }
            setData(formattedData);
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
            title: 'Service Hash',
            mapDataToValue: (data) => data[0],
        }),
        StringColumn({
            title: 'Proposer',
            mapDataToValue: (data) => data[1],
        }),
        StringColumn({
            title: 'Receiver',
            mapDataToValue: (data) => data[2],
        }),
        StringColumn({
            title: 'Token Address',
            mapDataToValue: (data) => data[3],
        }),
        StringColumn({
            title: 'Token Amount',
            mapDataToValue: (data) => data[4],
        }),
        StringColumn({
            title: 'Service ID',
            mapDataToValue: (data) => data[5],
        }),
    ];

    return (
        <HeadingLevel>
            <Heading>All Registered Services</Heading>
            <ParagraphSmall>Here you can view all your registered services.</ParagraphSmall>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getServices}>
                Retrieve
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            {data.length > 0 && <div className={css({height: '300px'})}>
                <StatefulDataTable columns={columns} rows={data} emptyMessage="No Data"/>
            </div>}
        </HeadingLevel>
    )
}

export default ServiceGetServices;