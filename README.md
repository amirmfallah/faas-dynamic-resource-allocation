# Auto-scaling FaaS

## Background Work

**Kubernetes Autoscaling (Horizontal Scaling)**

[Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

Horizontal scaling means that the response to increased load is to deploy more [Pods](https://kubernetes.io/docs/concepts/workloads/pods/). This is different from *vertical* scaling, which for Kubernetes would mean assigning more resources (for example: memory or CPU) to the Pods that are already running for the workload.

**Kubernetes Autoscaling (Vertical Scaling)**

[autoscaler/vertical-pod-autoscaler at master · kubernetes/autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)

Vertical Pod Autoscaler (VPA) frees users from the necessity of setting up-to-date resource limits and requests for the containers in their pods. When configured, it will set the requests automatically based on usage and thus allow proper scheduling onto nodes so that appropriate resource amount is available for each pod. It will also maintain ratios between limits and requests that were specified in initial containers configuration.

[](https://norma.ncirl.ie/4549/1/saifalisayyed.pdf)

Saifali Sayyed explains how a FaaS resource can be predicted and dynamically allocated using ARMIA statistical model.

### Creating a Serverless Function in Go

[GitHub - faas-and-furious/qrcode: QR Code generator function for the FaaS Platform in #golang](https://github.com/faas-and-furious/qrcode)

```go
package main

import (
	"encoding/binary"
	"io/ioutil"
	"log"
	"os"

	qrcode "github.com/skip2/go-qrcode"
)

func main() {
	input, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		log.Fatalf("Unable to read standard input: %s", err.Error())
	}
	png, err := qrcode.Encode(string(input), qrcode.Medium, 256)
	if err != nil {
		log.Fatalf("Unable to read standard input: %s", err.Error())
	}
	binary.Write(os.Stdout, binary.LittleEndian, png)
}
```

As an example, qrcode-go was selected and deployed to OpenFaaS. The process of generating images that contain data, such as QRCodes, are directly related to the size of data that is going to be encryped. With increasing or decreasing the data payload size, resource usage of the function will be affected.

Qrcode-go is available as a pre-build image tailored for functions as a service.

```bash
$ faas-cli -action deploy -image=faasandfurious/qrcode -name=qrcode -fprocess="/usr/bin/qrcode"
200 OK
```

### Deploying a function to OpenFaaS

```bash
$ kubectl port-forward svc/gateway -n openfaas 31112:8080 &
$ export OPENFAAS_URL=http://127.0.0.1:31112
$ echo $PASSWORD | faas-cli login -g $OPENFAAS_URL -u admin --password-stdin
```

```jsx
// Build and deploy a function to OpenFaas
$ faas-cli build -f func.yml
$ faas-cli push -f func.yml
$ faas-cli deploy -f func.yml

// Get function deployments on Kubernetes
// Openfaas functions will be deployed to openfaas-fn namespace
$ kubectl get deploy -n openfaas-fn
```

### Running Created OpenFaas Function

```bash
$ curl $OPENFAAS_URL:31112/function/qrcode --data "Hello World from OpenFaaS." > qrcode.png
```

![ebb57b50-c027-45db-91cb-f9bf5cd2d2ec.png](Auto-scaling%20FaaS%2065c306e7bde644e48ee0942066b2c05f/ebb57b50-c027-45db-91cb-f9bf5cd2d2ec.png)

## Functions Metrics Aquision

### Kubernetes Metrics API

OpenFaaS functions are created as Kubernetes Pod. They can be found under the `openfaas-fn` namespace in your Kubernetes node. For Kubernetes, the *Metrics API* offers a basic set of metrics to support automatic scaling and similar use cases. This API makes information available about resource usage for node and pod, including metrics for CPU and memory.

![Screen Shot 2023-01-03 at 11.09.52.png](Auto-scaling%20FaaS%2065c306e7bde644e48ee0942066b2c05f/Screen_Shot_2023-01-03_at_11.09.52.png)

The example below demonstrates an API call to Kubernetes Metrics API to recieve information about a `qrcode-go` pod, which was created earlier.

```json
$ kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/openfaas-fn/pods/qrcode-go-5f459f679d-6c7m9" | jq '.'

{
  "kind": "PodMetrics",
  "apiVersion": "metrics.k8s.io/v1beta1",
  "metadata": {
    "name": "qrcode-go-5f459f679d-6c7m9",
    "namespace": "openfaas-fn",
    "selfLink": "/apis/metrics.k8s.io/v1beta1/namespaces/openfaas-fn/pods/qrcode-go-5f459f679d-6c7m9",
    "creationTimestamp": "2022-12-29T12:53:23Z"
  },
  "timestamp": "2022-12-29T12:53:01Z",
  "window": "30s",
  "containers": [
    {
      "name": "qrcode-go",
      **"usage": {
        "cpu": "1641183n",
        "memory": "3736Ki"
      }**
    }
  ]
}
```

### Data Monitoring and Storing

\***\*Prometheus\*\*** is a systems monitoring application, which is especially built for handling time-series data. It supports complex queries using PromQL query language. In addition, Prometheus stores the collected data locally. Kubernetes Metrics API is based on Prometheus pull standard.

This diagram illustrates the architecture of Prometheus and some of its ecosystem components:

![https://prometheus.io/assets/architecture.png](https://prometheus.io/assets/architecture.png)

Promethues service discovery can be configured to pull data from Kubernetes Metrics API as below:

```yaml
- job_name: 'traefik'
    static_configs:
    - targets: ['traefik-prometheus:9100]
```

**Grafana** is a multi-platform open source analytics and interactive visualization web application. It provides charts, graphs, and alerts for the web when connected to supported data sources. To interact with OpenFaaS function metrics, a Grafana dashboard was configured by setting up a few PromQL queries.

```
// to retrieve pod's memory usage
container_memory_working_set_bytes{pod=~"qrcode-.*", image!="", container!="POD", id=~"/kubepods/.*"}

// to retrieve pod's CPU usage rate in 5 minutes period
rate(container_cpu_usage_seconds_total{pod=~"qrcode-.*", image!="", container!="POD", id=~"/kubepods/.*" }[5m])
```

![Screen Shot 2023-01-01 at 17.23.45.png](Auto-scaling%20FaaS%2065c306e7bde644e48ee0942066b2c05f/Screen_Shot_2023-01-01_at_17.23.45.png)

---

### Data Acquisition

To create a dataset, a NodeJS cron-job application was created to call the OpenFaaS function random times per minute. The application was calling the FaaS over a 6 hours period and the functions metrics was being collected.

[faas-dynamic-resource-allocation/invoker at master · amirmfallah/faas-dynamic-resource-allocation](https://github.com/amirmfallah/faas-dynamic-resource-allocation/tree/master/invoker)

Then, the pod’s resource usage was stored as a CSV file for furthur applications. The table below explains samples of pod’s metrics in 5 following timestamps.

| Index | Time              | mem_usage | cpu_usage |
| ----- | ----------------- | --------- | --------- |
| 0     | tel:1672557210000 | 5144576   | 0.001599  |
| 1     | tel:1672557225000 | 5144576   | 0.001587  |
| 2     | tel:1672557240000 | 5144576   | 0.001587  |
| 3     | tel:1672557255000 | 5144576   | 0.001587  |
| 4     | tel:1672557270000 | 5144576   | 0.001563  |

The table below demostrates statistical analysis of the collected data:

|       | mem_usage    | cpu_usage   |
| ----- | ------------ | ----------- |
| count | 1.111000e+03 | 1111.000000 |
| mean  | 7.123128e+06 | 0.008101    |
| std   | 9.949669e+05 | 0.004616    |
| min   | 5.050368e+06 | 0.001054    |
| 25%   | 7.352320e+06 | 0.003012    |
| 50%   | 7.528448e+06 | 0.008684    |
| 75%   | 7.757824e+06 | 0.011573    |
| max   | 7.999488e+06 | 0.018026    |

---

### **Dataset Prepration**

Prior to LSTM development, data normalization was performed to align the different parameters in a same scale using standard score method:

$$
z_i = \dfrac{x_i - μ }{\sigma}
$$

| Index | mem_usage | cpu_usage |
| ----- | --------- | --------- |
| 0     | -1.989457 | -1.409124 |
| 1     | -1.989457 | -1.411753 |
| 2     | -1.989457 | -1.411753 |
| 3     | -1.989457 | -1.411753 |
| 4     | -1.989457 | -1.416867 |

To transorm the scaled dataset in a form of inputs and outputs, time series data was converted to supervised data using the **series_to_supervised** method. The records of the past 3 timestamps were taken into action to predict the currect timestamp data, as shown below:

| var1(t-3) | var2(t-3) | var1(t-2) | var2(t-2) | var1(t-1) | var2(t-1) | var1(t)   | var2(t)   |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| -1.989457 | -1.409124 | -1.989457 | -1.411753 | -1.989457 | -1.411753 | -1.989457 | -1.411753 |
| -1.989457 | -1.411753 | -1.989457 | -1.411753 | -1.989457 | -1.411753 | -1.989457 | -1.416867 |
| -1.989457 | -1.411753 | -1.989457 | -1.411753 | -1.989457 | -1.416867 | -1.989457 | -1.416867 |

---

### **Model Architecture**

LSTM is normally used for learning time-series data patterns. Since the collected data are sampled on regular timestamps, A ANN explained as below was constructed:

```python
model = Sequential()
model.add(LSTM(64, input_shape=(train_X.shape[1], train_X.shape[2])))
model.add(Dense(2))
model.compile(loss='mae', optimizer='adam')
```

Then the model was trained, evaluated and tested on the dataset.

![18C7E914-0D9C-4CBA-B8E0-327AC2B55EE4.png](Auto-scaling%20FaaS%2065c306e7bde644e48ee0942066b2c05f/18C7E914-0D9C-4CBA-B8E0-327AC2B55EE4.png)

---

### **Model Evaluation**

The trained model was evaluated with MSE, MAE and RMSE measures as listed in the following table:

| #    | Memory Usage           | CPU Usage              |
| ---- | ---------------------- | ---------------------- |
| MSE  | tel:23849780552.629097 | 1.4697250697495431e-06 |
| MAE  | 50345.6543715847       | 0.0009084099362412646  |
| RMSE | 154433.74162607436     | 0.0012123221806720947  |

![EA45B626-E8AE-43E6-AB8E-BE52B0A7E2E2.png](Auto-scaling%20FaaS%2065c306e7bde644e48ee0942066b2c05f/EA45B626-E8AE-43E6-AB8E-BE52B0A7E2E2.png)

---

### Assigning CPU/Memory Resources to Containers

After building and training the neural network model, the function’s resource usage can now be predicted based on it’s recent activities. By creating a new controller application, we can now observe function’s resource usage and forecast it’s consumption in the next timestamp.

Then we can update function’s resource allocation by manipulating it’s config `yaml` file.

```yaml
 qrcode-go:
    lang: go
    .
		.
		.
    limits:
      memory: 40Mi
			cpu: 100m
    requests:
      memory: 20Mi
			cpu: 100m
```
