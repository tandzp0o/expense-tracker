import React from "react";
import { Bar } from "react-chartjs-2";
import { ensureChartJsRegistered } from "./chartRegistry";
import { barChartData, barChartOptions } from "../../theme/chartConfigs";

interface BarChartProps {
    data?: any;
    options?: any;
}

const BarChart: React.FC<BarChartProps> = ({ data, options }) => {
    ensureChartJsRegistered();

    return (
        <div className="bar-chart" style={{ height: "100%" }}>
            <Bar
                data={data || barChartData}
                options={options || barChartOptions}
            />
        </div>
    );
};

export default BarChart;
