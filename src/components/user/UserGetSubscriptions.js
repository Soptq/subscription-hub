import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import React, {useContext, useState} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";
import {StatefulDataTable, StringColumn} from "baseui/data-table";
import {useStyletron} from "baseui";

function UserGetSubscriptions() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [css] = useStyletron();
    const { context} = useContext(Context);
    const { enqueue } = useSnackbar();

    const getSubscriptions = async () => {
        setLoading(true);
        try {
            const checkedAddress = ethers.utils.getAddress(context.walletAddress);
            const subscriptions = await context.contract.getSubscriptions(checkedAddress);
            const formattedData = []
            for (const subscription of subscriptions) {
                const serviceHash = subscription.serviceHash;
                const version = subscription.version.toString();
                formattedData.push({
                    data: [serviceHash, version]
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
            title: 'Version',
            mapDataToValue: (data) => data[1],
        }),
    ];

    return (
        <HeadingLevel>
            <Heading>All Subscriptions</Heading>
            <ParagraphSmall>Here you can view all your subscribed services.</ParagraphSmall>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={getSubscriptions}>
                Retrieve
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            {data.length > 0 && <div className={css({height: '300px'})}>
                <StatefulDataTable columns={columns} rows={data} emptyMessage="No Data"/>
            </div>}
        </HeadingLevel>
    )
}

export default UserGetSubscriptions;