import {
	aws_codebuild as codebuild,
	aws_codepipeline as codepipeline,
	aws_ecr as ecr,
	aws_ecs as ecs,
	aws_ecs_patterns as ecspatterns, Duration,
	SecretValue,
	Stack,
	StackProps
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Artifact} from 'aws-cdk-lib/aws-codepipeline';
import {Vpc} from 'aws-cdk-lib/aws-ec2';
import {ManagedPolicy} from 'aws-cdk-lib/aws-iam';
import {
	CodeBuildAction,
	CodeBuildActionProps,
	EcsDeployAction,
	GitHubSourceAction
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {LocalCacheMode} from 'aws-cdk-lib/aws-codebuild';
import { DashboardRenderingPreference, DefaultDashboardFactory, FargateServiceMonitoring, MonitoringFacade } from 'cdk-monitoring-constructs';
import {RetentionDays} from "aws-cdk-lib/aws-logs";

const repoName = 'spring-boot-aws-fargate-test';

export class CdkFargateTestStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const oauthToken = SecretValue.secretsManager('github/oauth/token');

		let sourceOutput: Artifact;
		let buildOutput: Artifact;

		//Place resource definitions here.
		const vpc = new Vpc(this, 'my.vpc', {
			cidr: '10.0.0.0/16',
			maxAzs: 2
		});

		// ECR repository
		const ecrRepository = new ecr.Repository(this, repoName, {
			repositoryName: repoName,
		});

		const pipelineProject = this.createPipelineProject(ecrRepository);
		pipelineProject.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

		sourceOutput = new Artifact();
		buildOutput = new Artifact();

		const githubSourceAction = this.createHelloWorldGithubSourceAction(sourceOutput, oauthToken);
		const buildAction = this.createHelloWorldBuildAction(pipelineProject, sourceOutput, buildOutput);

		const fargateService = this.createLoadBalancedFargateService(this, vpc)
		const ecsDeployAction = this.createEcsDeployAction(vpc, fargateService.service, buildOutput);

		const dashboardFactory = new DefaultDashboardFactory(this, 'DefaultDashboardFactory', {
			dashboardNamePrefix: 'Fargate-Monitoring',
			createDashboard: true,
			createAlarmDashboard: true,
			createSummaryDashboard: true,
			renderingPreference: DashboardRenderingPreference.INTERACTIVE_ONLY,			
		});
	
		const monitoring = new MonitoringFacade(this, 'MonitoringFacade', {
			alarmFactoryDefaults: {
				alarmNamePrefix: 'fargate_',
				actionsEnabled: true,
				datapointsToAlarm: 3,
			},
			metricFactoryDefaults: {
				namespace: 'fargate',
			},
			dashboardFactory,			
		});
		
		monitoring
			.addMediumHeader('Fargate Monitor')
			.monitorFargateService({
				fargateService: fargateService,
				addUnhealthyTaskCountAlarm: {

				}
			});

		new codepipeline.Pipeline(this, 'my_pipeline_', {
			stages: [
				{
					stageName: 'Source',
					actions: [githubSourceAction]
				},
				{
					stageName: 'Build',
					actions: [buildAction]
				},
				{
					stageName: 'Deploy',
					actions: [ecsDeployAction]
				},
			],
			pipelineName: 'my_pipeline',
		});

	}

	/**
	 * creates Github Source
	 * @param sourceOutput where to put the clones Repository
	 * @param oauthToken the oauthToken for the github repository
	 */
	public createHelloWorldGithubSourceAction(sourceOutput: Artifact, oauthToken: SecretValue): GitHubSourceAction {
		return new GitHubSourceAction({
			actionName: 'my_github_source',
			owner: 'randyridgley',
			repo: repoName,
			oauthToken: oauthToken,
			output: sourceOutput,
			branch: 'main',
		});
	}

	/**
	 * Creates the BuildAction for Codepipeline build step
	 * @param pipelineProject pipelineProject to use
	 * @param sourceActionOutput input to build
	 * @param buildOutput where to put the ouput
	 */
	public createHelloWorldBuildAction(pipelineProject: codebuild.IProject, sourceActionOutput: Artifact,
	                                   buildOutput: Artifact): CodeBuildAction {

		return new CodeBuildAction(<CodeBuildActionProps>{
			actionName: 'HelloWorldWebAppBuild',
			project: pipelineProject,
			input: sourceActionOutput,
			outputs: [buildOutput]
		});
	}

	public createEcsDeployAction(vpc: Vpc, service: ecs.IBaseService, buildOutput: Artifact): EcsDeployAction {
		return new EcsDeployAction({
			actionName: 'EcsDeployAction',
			service: service,
			input: buildOutput,			
		})
	};

	protected createLoadBalancedFargateService(scope: Construct, vpc: Vpc) {
		const cluster = new ecs.Cluster(this, 'Cluster', {
			vpc: vpc,
			clusterName: `fargate-spring-boot-cluster`,
			containerInsights: true,
			enableFargateCapacityProviders: true,
		});
	  
		const fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(scope, 'myLbFargateService', {
			cluster: cluster,
			memoryLimitMiB: 512,
			cpu: 256,
			assignPublicIp: true,
			platformVersion: ecs.FargatePlatformVersion.LATEST,
			taskImageOptions: {
				containerName: repoName,
				image: ecs.ContainerImage.fromRegistry('okaycloud/dummywebserver:latest'),
				containerPort: 8080,
				logDriver: ecs.LogDrivers.awsLogs({
					streamPrefix: 'fargate/spring-boot/',
					logRetention: RetentionDays.ONE_YEAR,
				}),
			},
			healthCheckGracePeriod: Duration.seconds(300),
			circuitBreaker: {
				rollback: true
			},
		});
		fargateService.taskDefinition.executionRole?.addManagedPolicy((ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')));
		fargateService.targetGroup.healthCheck = {
			path: "/api/index",
			healthyHttpCodes: "200",
			unhealthyThresholdCount: 5,
			timeout: Duration.seconds(15),
			interval: Duration.seconds(120),
		};

		const scalableTarget = fargateService.service.autoScaleTaskCount({
			minCapacity: 1,
			maxCapacity: 20,
		});

		scalableTarget.scaleOnCpuUtilization('CpuScaling', {
			targetUtilizationPercent: 50,
			scaleInCooldown: Duration.seconds(60),
			scaleOutCooldown: Duration.seconds(60),
		});

		scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
			targetUtilizationPercent: 50,
			scaleInCooldown: Duration.seconds(60),
			scaleOutCooldown: Duration.seconds(60),
		});
		return fargateService;
	}

	// ----------------------- some helper methods -----------------------
	/**
	 * create the Pipeline Project wuth Buildspec and stuff
	 */
	private createPipelineProject(ecrRepo: ecr.Repository): codebuild.PipelineProject {
		return new codebuild.PipelineProject(this, 'my-codepipeline', {
			projectName: 'my-codepipeline',
			environment: {
				buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
				privileged: true
			},
			environmentVariables: {
				'ECR_REPO': {
					value: ecrRepo.repositoryUriForTag()
				}
			},
			buildSpec: codebuild.BuildSpec.fromObject({
				version: '0.2',
				phases: {
					install: {
						commands: [
							'#apt-get update -y',
						],
						finally: [
							'echo Done installing deps'
						],
					},
					pre_build: {
						commands: [
							'echo Logging in to Amazon ECR...',
							'$(aws ecr get-login --no-include-email)',
							'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
							'IMAGE_TAG=${COMMIT_HASH:=latest}'
						],
					},
					build: {
						commands: [
							'echo Build started on `date`',
							'./mvnw clean package',
							'echo Building Docker Image $ECR_REPO:latest',
							'docker build -f docker/Dockerfile -t $ECR_REPO:latest .',
							'echo Tagging Docker Image $ECR_REPO:latest with $ECR_REPO:$IMAGE_TAG',
							'docker tag $ECR_REPO:latest $ECR_REPO:$IMAGE_TAG',
							'echo Pushing Docker Image to $ECR_REPO:latest and $ECR_REPO:$IMAGE_TAG',
							'docker push $ECR_REPO:latest',
							'docker push $ECR_REPO:$IMAGE_TAG'
						],
						finally: [
							'echo Done building code'
						],
					},
					post_build: {
						commands: [
							'echo creating imagedefinitions.json dynamically',
							'printf \'[{"name":"' + repoName + '","imageUri": "' + ecrRepo.repositoryUriForTag() + ':latest"}]\' > imagedefinitions.json',
							'echo Build completed on `date`'
						]
					}
				},
				artifacts: {
					files: [
						'imagedefinitions.json'
					]
				},
				cache: {
					paths: [
						'/root/.gradle/**/*',
					]
				}
			}),
			cache: codebuild.Cache.local(LocalCacheMode.DOCKER_LAYER, LocalCacheMode.CUSTOM)
		});
	}
}
