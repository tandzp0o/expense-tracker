import React from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJsRegistered } from "./chartRegistry";
import { lineChartData, lineChartOptions } from "../../theme/chartConfigs";

interface LineChartProps {
    data?: any;
    options?: any;
}

const LineChart: React.FC<LineChartProps> = ({ data, options }) => {
    ensureChartJsRegistered();

    return (
        <div className="full-width" style={{ height: "100%" }}>
            <Line
                data={data || lineChartData}
                options={options || lineChartOptions}
            />
        </div>
    );
};

export default LineChart;
