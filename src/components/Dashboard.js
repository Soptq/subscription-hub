import React, {useContext, useEffect} from 'react';
import {useStyletron} from 'baseui';
import {
    StatefulDataTable,
    NumericalColumn,
} from 'baseui/data-table';
import { Heading, HeadingLevel } from 'baseui/heading'

import {Context} from "../Context";
import {DisplayXSmall, ParagraphSmall} from "baseui/typography";
import {Card} from "baseui/card";

function Dashboard() {
    const [css] = useStyletron();
    const { context} = useContext(Context);
    const [data, setData] = React.useState([]);
    const [currentBlock, setCurrentBlock] = React.useState(0);

    useEffect(() => {
        const interval = setInterval(async () => {
            const feePercentage = await context.contract.getFeePercentage();
            const paymentInterval = await context.contract.getPaymentInterval();
            const serviceCount = await context.contract.getServiceCount();
            const subscriptionCount = await context.contract.getTotalSubscriptionCount();
            const currentBlock = await context.provider.getBlockNumber();
            setData([{
                id: 0,
                data: [feePercentage, paymentInterval, serviceCount, subscriptionCount],
            }]);
            setCurrentBlock(currentBlock);
        }, 1000);
        return () => clearInterval(interval);
    }, [context.contract, context.provider]);

    const columns = [
        NumericalColumn({
            title: 'Fee Percentage (%)',
            mapDataToValue: (data) => data[0],
        }),
        NumericalColumn({
            title: 'Payment Interval (Blocks)',
            mapDataToValue: (data) => data[1],
        }),
        NumericalColumn({
            title: '# Services',
            mapDataToValue: (data) => data[2],
        }),
        NumericalColumn({
            title: '# Subscriptions',
            mapDataToValue: (data) => data[3],
        }),
    ];

    return ( context.configured &&
            <Card>
                <HeadingLevel>
                    <Heading>
                        Dashboard
                    </Heading>
                    <div className={css({height: '145px'})}>
                        <StatefulDataTable columns={columns} rows={data} emptyMessage="No Data"/>
                    </div>
                    <ParagraphSmall><strong>Fee Percentage (%)</strong>: How many percentage the contract will charge for each payment.</ParagraphSmall>
                    <ParagraphSmall><strong>Payment Interval (Blocks)</strong>: How many blocks between two payments, i.e. the subscription period.</ParagraphSmall>
                    <ParagraphSmall><strong># Services</strong>: How many services registered to the contract.</ParagraphSmall>
                    <ParagraphSmall><strong># Subscriptions</strong>: How many subscriptions registered to the contract.</ParagraphSmall>
                    <ParagraphSmall> Current Block is:
                        <DisplayXSmall>
                            {currentBlock.toString()}
                        </DisplayXSmall>
                    </ParagraphSmall>
                </HeadingLevel>
            </Card>
    )
}

export default Dashboard;