import React from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJsRegistered } from "./chartRegistry";
import { areaChartData, areaChartOptions } from "../../theme/chartConfigs";

interface AreaChartProps {
    data?: any;
    options?: any;
}

const AreaChart: React.FC<AreaChartProps> = ({ data, options }) => {
    ensureChartJsRegistered();

    return (
        <div className="full-width" style={{ height: "100%" }}>
            <Line
                data={data || areaChartData}
                options={options || areaChartOptions}
            />
        </div>
    );
};

export default AreaChart;
